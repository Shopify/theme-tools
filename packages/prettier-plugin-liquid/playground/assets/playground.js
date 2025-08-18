const options = {
  printWidth: 120,
};

const numInputs = ['printWidth', 'tabWidth'];
const boolInputs = [
  'useTabs',
  'bracketSameLine',
  'liquidSingleQuote',
  'embeddedSingleQuote',
  'singleLineLinkTags',
  'indentSchema',
];
const selectInputs = ['htmlWhitespaceSensitivity', 'captureWhitespaceSensitivity'];

const waitFor = (pred) => {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (pred()) {
        resolve();
        clearInterval(interval);
      }
    }, 50);
  });
};

numInputs.forEach((input) => {
  const el = document.getElementById(input);
  el.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    options[input] = value;
    el.value = value;
    format();
  });
});

boolInputs.forEach((input) => {
  const el = document.getElementById(input);
  el.addEventListener('input', (e) => {
    options[input] = !!e.target.checked;
    format();
  });
});

selectInputs.forEach((input) => {
  const el = document.getElementById(input);
  el.addEventListener('input', (e) => {
    options[input] = el.options[el.selectedIndex].value;
    format();
  });
});

function format() {
  try {
    output.value = prettier.format(input.value, {
      ...options,
      plugins: prettierPlugins,
      parser: 'liquid-html',
    });
    ruler.style.left = `${options.printWidth}ch`;
  } catch (error) {
    output.value = error.stack || error;
  }
}

function onKeyup(e) {
  if (e.ctrlKey && event.key === 'f') {
    input.value = output.value;
  }
}

async function main() {
  await Promise.all([
    waitFor(() => window.prettierPluginLiquid),
    waitFor(() => window.prettierPlugins),
    waitFor(() => window.prettier),
  ]);
  prettierPlugins['liquid-html'] = prettierPluginLiquid;
  format();
  input.oninput = format;
  input.addEventListener('keyup', onKeyup);
}

main();
