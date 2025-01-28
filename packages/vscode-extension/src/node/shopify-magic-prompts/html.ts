export function htmlRules() {
  return `
<html>
  - Use semantic HTML
  - Use modern HTML features where appropriate, e.g. use \`<details>\` and \`<summary>\` over JS to show and hide content
  - Use \`CamelCase\` for IDs. When appending a block or section ID, append \`-{{ block.id }}\` or \`-{{ section.id }}\` respectively

  <accessibility>
    - Ensure all interactive elements are focusable. e.g. if you use a label to style a checkbox, include \`tabindex="0"\`
    - Only use \`tabindex="0"\` unless absolutely necessary, to avoid hijacking tab flow
  </accessibility>
</html>
  `;
}
