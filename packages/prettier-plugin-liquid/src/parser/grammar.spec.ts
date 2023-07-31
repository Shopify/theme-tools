import { expect } from 'chai';
import { placeholderGrammars, strictGrammars, tolerantGrammars } from '~/parser/grammar';

describe('Unit: liquidHtmlGrammar', () => {
  const grammars = [
    { mode: 'strict', grammar: strictGrammars },
    { mode: 'tolerant', grammar: tolerantGrammars },
    { mode: 'completion', grammar: placeholderGrammars },
  ];

  describe(`Case: common to all grammars`, () => {
    it('should parse or not parse HTML+Liquid', () => {
      grammars.forEach(({ grammar }) => {
        expectMatchSucceeded('<h6 data-src="hello world">').to.be.true;
        expectMatchSucceeded('<a src="https://product"></a>').to.be.true;
        expectMatchSucceeded('<a src="https://google.com"></b>').to.be.true;
        expectMatchSucceeded(`<img src="hello" loading='lazy' enabled=true disabled>`).to.be.true;
        expectMatchSucceeded(`<img src="hello" loading='lazy' enabled=true disabled />`).to.be.true;
        expectMatchSucceeded(`<{{header_type}}-header>`).to.be.true;
        expectMatchSucceeded(`<header--{{header_type}}>`).to.be.true;
        expectMatchSucceeded(`<-nope>`).to.be.false;
        expectMatchSucceeded(`<:nope>`).to.be.false;
        expectMatchSucceeded(`<1nope>`).to.be.false;
        expectMatchSucceeded(`{{ product.feature }}`).to.be.true;
        expectMatchSucceeded(`{{product.feature}}`).to.be.true;
        expectMatchSucceeded(`{%- if A -%}`).to.be.true;
        expectMatchSucceeded(`{%-if A-%}`).to.be.true;
        expectMatchSucceeded(`{%- else-%}`).to.be.true;
        expectMatchSucceeded(`{%- break-%}`).to.be.true;
        expectMatchSucceeded(`{%- continue -%}`).to.be.true;
        expectMatchSucceeded(`{%- liquid-%}`).to.be.true;
        expectMatchSucceeded(`{%- schema-%}{% endschema %}`).to.be.true;
        expectMatchSucceeded(`{%- form 'form-type'-%}`).to.be.true;
        expectMatchSucceeded(`{%- # a comment -%}`).to.be.true;
        expectMatchSucceeded(`{%- javascript -%}{% endjavascript %}`).to.be.true;
        expectMatchSucceeded(`{%- include 'layout' -%}`).to.be.true;
        expectMatchSucceeded(`{%- layout 'full-width' -%}`).to.be.true;
        expectMatchSucceeded(`{%- layout none -%}`).to.be.true;
        expectMatchSucceeded(`{% render 'filename' for array as item %}`).to.be.true;
        expectMatchSucceeded(`{% section 'name' %}`).to.be.true;
        expectMatchSucceeded(`{% sections 'name' %}`).to.be.true;
        expectMatchSucceeded(`{% style %}{% endstyle %}`).to.be.true;
        expectMatchSucceeded(`{% stylesheet %}{% endstylesheet %}`).to.be.true;
        expectMatchSucceeded(`{% assign variable_name = value %}`).to.be.true;
        expectMatchSucceeded(`
          {% capture variable %}
            value
          {% endcapture %}
        `).to.be.true;
        expectMatchSucceeded(`
          {% for variable in array limit: number %}
            expression
          {% endfor %}
        `).to.be.true;

        expectMatchSucceeded(`{% decrement variable_name %}`).to.be.true;
        expectMatchSucceeded(`{% increment variable_name %}`).to.be.true;
        expectMatchSucceeded(`{{ true-}}`).to.be.true;
        expectMatchSucceeded(`
          <html>
            <head>
              {{ 'foo' | script_tag }}
            </head>
            <body>
              {% if true %}
                <div>
                  hello world
                </div>
              {% else %}
                nope
              {% endif %}
            </body>
          </html>
        `).to.be.true;
        expectMatchSucceeded(`
          <input
            class="[[ cssClasses.checkbox ]] form-checkbox sm:text-[8px]"
            type="checkbox"

            [[# isRefined ]]
              checked
            [[/ isRefined ]]
          />
        `).to.be.true;
        expectMatchSucceeded(`
          <svg>
              <svg a=1><svg b=2>
                <path d="M12"></path>
              </svg></svg>
          </svg>
        `).to.be.true;
        expectMatchSucceeded(`<div data-popup-{{ section.id }}="size-{{ section.id }}">`).to.be
          .true;
        expectMatchSucceeded('<img {% if aboveFold %} loading="lazy"{% endif %} />').to.be.true;
        expectMatchSucceeded('<svg><use></svg>').to.be.true;
        expectMatchSucceeded('<6h>').to.be.false;

        function expectMatchSucceeded(text: string) {
          const match = grammar.LiquidHTML.match(text, 'Node');
          return expect(match.succeeded(), text);
        }
      });
    });

    it('should parse or not parse {% liquid %} lines', () => {
      grammars.forEach(({ grammar }) => {
        expectMatchSucceeded(`
          layout none

          paginate search.results by 28
            for item in search.results
              if item.object_type != 'product'
                continue
              endif

              render 'product-item', product: item
            endfor
          endpaginate
        `).to.be.true;

        function expectMatchSucceeded(text: string) {
          const match = grammar.LiquidStatement.match(text.trimStart(), 'Node');
          return expect(match.succeeded(), text);
        }
      });
    });
  });

  describe('Case: placeholderGrammars', () => {
    it('should parse special placeholder characters', () => {
      expectMatchSucceeded('{% █ %}').to.be.true;
      expectMatchSucceeded('{{ █ }}').to.be.true;
      expectMatchSucceeded('{{ var.█ }}').to.be.true;
      expectMatchSucceeded('{{ var[█] }}').to.be.true;
      expectMatchSucceeded('{% echo █ %}').to.be.true;
      expectMatchSucceeded('{% echo var.█ %}').to.be.true;
      expectMatchSucceeded('{% echo var[█] %}').to.be.true;
      expectMatchSucceeded('{% echo var | █ %}').to.be.true;
      expectMatchSucceeded('{% echo var | replace: █ %}').to.be.true;
      expectMatchSucceeded('{% echo var | replace: "foo", █ %}').to.be.true;
      expectMatchSucceeded('{% echo var | replace: "foo", var: █ %}').to.be.true;
    });

    function expectMatchSucceeded(text: string) {
      const match = placeholderGrammars.Liquid.match(text.trimStart(), 'Node');
      return expect(match.succeeded(), text);
    }
  });
});
