// test/checks/required-layout-theme-object.test.ts
import { expect, describe, it } from 'vitest';
import { RequiredLayoutThemeObject } from './index';
import { runLiquidCheck, applyFix } from '../../test';

describe('Module: RequiredLayoutThemeObject', () => {
  it('should report an error if content_for_header is missing', async () => {
    const input = `
      <html>
        <head>
          <!-- missing content_for_header -->
        </head>
        <body>
          {{ content_for_layout }}
        </body>
      </html>
    `;

    const offenses = await runLiquidCheck(RequiredLayoutThemeObject, input, 'layout/theme.liquid');
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The required object '{{ content_for_header }}' is missing in layout/theme.liquid",
    );

    const fix = applyFix(input, offenses[0]);
    expect(fix).to.exist;
    expect(fix!).to.include('{{ content_for_header }}');
  });

  it('should report an error if content_for_layout is missing', async () => {
    const input = `
      <html>
        <head>
          {{ content_for_header }}
        </head>
        <body>
          <!-- missing content_for_layout -->
        </body>
      </html>
    `;

    const offenses = await runLiquidCheck(RequiredLayoutThemeObject, input, 'layout/theme.liquid');
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The required object '{{ content_for_layout }}' is missing in layout/theme.liquid",
    );

    const fix = applyFix(input, offenses[0]);
    expect(fix).to.exist;
    expect(fix!).to.include('{{ content_for_layout }}');
  });

  it('should not report an error if both content_for_header and content_for_layout are present', async () => {
    const input = `
      <html>
        <head>
          {{ content_for_header }}
        </head>
        <body>
          {{ content_for_layout }}
        </body>
      </html>
    `;

    const offenses = await runLiquidCheck(RequiredLayoutThemeObject, input, 'layout/theme.liquid');
    expect(offenses).to.have.length(0);
  });

  it('should not report an error or fix if head or body tags are missing', async () => {
    const input = `
      <html>
        <!-- missing head and body tags -->
        {{ content_for_header }}
        {{ content_for_layout }}
      </html>
    `;

    const offenses = await runLiquidCheck(RequiredLayoutThemeObject, input, 'layout/theme.liquid');
    expect(offenses).to.have.length(0);
  });

  it('should not report an error for non-layout/theme.liquid files', async () => {
    const input = `{% echo 'hello world' %}`;
    const offenses = await runLiquidCheck(
      RequiredLayoutThemeObject,
      input,
      'snippets/example.liquid',
    );
    expect(offenses).to.have.length(0);
  });

  it('should not report an error if the file is unparseable', async () => {
    const input = `
      <html>
        <head>{{ content_for_header }}</head>
        <body>{{ content_for_layout }}{% echo }}</body>
      </html>
    `;

    const offenses = await runLiquidCheck(
      RequiredLayoutThemeObject,
      input,
      'snippets/example.liquid',
    );
    expect(offenses).to.have.length(0);
  });
});
