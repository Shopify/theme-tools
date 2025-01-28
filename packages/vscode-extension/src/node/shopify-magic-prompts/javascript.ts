export function javascriptRules() {
  return `
<javascript>
  <general_principles>
    - Lean towards using zero external dependencies
    - Use JS when needed, but reach for native browser features first
      - e.g. use "popover" or "details" over JS unless there is a good reason to do otherwise
    - Do not use "var"
    - Prefer "const" over "let" - avoid mutation unless necessary
    - Prefer "for (const thing of things)" over "things.forEach()"
    - Put new lines before new "blocks" of code. A block is anything with a "{" and "}"
  </general_principles>

  <file_structure>
    - Group scripts by feature area where appropriate
      - e.g. "facets.js" contains multiple classes related to facets, they don't each need to be their own file
  </file_structure>

  <modules>
    - Use the module pattern for loading JavaScript. This avoids polluting the global scope and allows for easier code splitting.
    - See "facets.js" which uses "section-renderer" for an example.
    - Note that you need to import modules via the importmap:
      - See "layout/theme.liquid" and search for "importmap" to find our global modules
      - This is necessary to bust the cache from the CDN and ensure you get the latest version of the JS file you're referencing
    - Use the "kebab-case" to name modules in the "importmap"

    <privacy_and_instance_methods>
      - The public API of a module should be the smallest possible surface to provide the necessary functionality
      - All other instance methods should be prefixed with "#" and are private
      - Do not use instance methods for functions that do not use the class instance

      <code>
        class MyClass {
          constructor() {
            this.cache = new Map();
          }

          // This is a method that is meant to be used by other classes that import this module
          myPublicMethod() {
            this.#myPrivateMethod();
          }

          // This is a method that is only meant to be used within this module and requires access to the instance
          #myPrivateMethod() {
            this.cache.set('key', 'value');
          }
        }

        // This is a utility that is scoped to this module.  It does not require access to the instance to work
        const someUtilityFunction = (num1, num2) => num1 + num2;
      </code>
    </privacy_and_instance_methods>
  </modules>

  <asynchronous_code>
    - Prefer to use "async/await" syntax
    - Prefer to use "await" over chaining ".then()"
  </asynchronous_code>

  <events>
    - Use events to communicate between custom elements. This avoids explicit dependencies.
  </events>

  <web_components>
    - Initialize JS components in the DOM using custom elements
      - This allows them to update when added into the DOM via the editor more seamlessly
    - Use of shadow DOM
    - Use of slots
  </web_components>

  <early_returns>
    - Prefer early returns over nested conditionals

    <optional_chaining>
      If you need to use multiple instances of Optional Chaining, prefer to use an early return instead.
      Single optional chain usage is acceptable.

      <code>
        // Multiple optional chains - use early return instead
        const button = this.querySelector('ref="button"');
        if (!button) return;
        button.enable();
        button.textContent = 'Add to cart';

        // Single optional chain is fine
        const button = this.querySelector('ref="button"');
        button?.enable();
      </code>
    </optional_chaining>
  </early_returns>

  <simplification>
    <ternaries>
      Use ternaries for simple if/else blocks where both the condition and body are simple:
      <code>
        simpleCondition ? this.doAThing() : this.doAnotherThing();
      </code>
    </ternaries>

    <one_liners>
      Write simple conditional returns on one line:
      <code>
        if (simpleCondition) return;
      </code>
    </one_liners>

    <returning_boolean>
      Return boolean comparisons directly rather than using ternaries:
      <code>
        return simpleCondition;
      </code>
    </returning_boolean>
  </simplification>
</javascript>`;
}
