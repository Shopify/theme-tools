import { expect, describe, it } from 'vitest';
import { JSONMissingSection } from './index';
import { check, MockTheme } from '../../test';

describe('Module: JSONMissingSection', () => {
  describe('JSON templates', () => {
    it('should report an offense when a section file does not exist', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "hero_AAAAAA": {
              "type": "featured-collection"
            }
          },
          "order": ["hero_AAAAAA"]
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Section type 'featured-collection' does not refer to an existing section file",
      );

      const content = theme['templates/index.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"featured-collection"');
    });

    it('should not report an offense when the section file exists', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "hero_AAAAAA": {
              "type": "featured-collection"
            }
          },
          "order": ["hero_AAAAAA"]
        }`,
        'sections/featured-collection.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });

    it('should report an offense for each missing section', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "hero_AAAAAA": {
              "type": "missing-one"
            },
            "main": {
              "type": "existing-section"
            },
            "footer_BBBBBB": {
              "type": "missing-two"
            }
          },
          "order": ["hero_AAAAAA", "main", "footer_BBBBBB"]
        }`,
        'sections/existing-section.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.have.length(2);
      expect(offenses[0].message).to.equal(
        "Section type 'missing-one' does not refer to an existing section file",
      );
      expect(offenses[1].message).to.equal(
        "Section type 'missing-two' does not refer to an existing section file",
      );
    });

    it('should not report an offense for section types with platform defaults', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "apps_section": {
              "type": "apps"
            },
            "blocks_section": {
              "type": "_blocks"
            }
          },
          "order": ["apps_section", "blocks_section"]
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });

    it('should not report an offense when a section entry has no type', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "inherited_section": {
              "settings": {}
            }
          },
          "order": ["inherited_section"]
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });
  });

  describe('Section groups', () => {
    it('should report an offense when a section file does not exist', async () => {
      const theme: MockTheme = {
        'sections/header-group.json': `{
          "type": "header",
          "name": "Header group",
          "sections": {
            "announcement": {
              "type": "missing-announcement-bar"
            }
          },
          "order": ["announcement"]
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Section type 'missing-announcement-bar' does not refer to an existing section file",
      );

      const content = theme['sections/header-group.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"missing-announcement-bar"');
    });

    it('should not report an offense when the section file exists', async () => {
      const theme: MockTheme = {
        'sections/header-group.json': `{
          "type": "header",
          "name": "Header group",
          "sections": {
            "announcement": {
              "type": "announcement-bar"
            }
          },
          "order": ["announcement"]
        }`,
        'sections/announcement-bar.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });

    it('should not report an offense for the section group type itself', async () => {
      const theme: MockTheme = {
        'sections/header-group.json': `{
          "type": "header",
          "name": "Header group",
          "sections": {},
          "order": []
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });
  });

  describe('Edge cases', () => {
    it('should ignore JSON files outside templates/ and sections/', async () => {
      const theme: MockTheme = {
        'config/settings_data.json': `{
          "sections": {
            "main": {
              "type": "nonexistent"
            }
          }
        }`,
        'locales/en.default.json': `{
          "sections": {
            "main": { "type": "nonexistent" }
          }
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });

    it('should not report an offense when sections is not an object', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": "not-an-object",
          "order": []
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });

    it('should report each duplicate section key at its own location', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{
          "sections": {
            "main": {
              "type": "missing-one"
            },
            "main": {
              "type": "missing-two"
            }
          },
          "order": ["main"]
        }`,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.have.length(2);

      const content = theme['templates/index.json'];
      expect(offenses[0].message).to.equal(
        "Section type 'missing-one' does not refer to an existing section file",
      );
      expect(content.slice(offenses[0].start.index, offenses[0].end.index)).to.equal(
        '"missing-one"',
      );
      expect(offenses[1].message).to.equal(
        "Section type 'missing-two' does not refer to an existing section file",
      );
      expect(content.slice(offenses[1].start.index, offenses[1].end.index)).to.equal(
        '"missing-two"',
      );
    });

    it('should not report an offense when the JSON is invalid', async () => {
      const theme: MockTheme = {
        'templates/index.json': `{ "sections": { "main": { "type": `,
      };

      const offenses = await check(theme, [JSONMissingSection]);
      expect(offenses).to.be.empty;
    });
  });
});
