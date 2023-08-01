function check() {
  try {
    ThemeCheck.simpleCheck(
      {
        'snippets/foo.liquid': input.value,
      },
      {
        settings: {},
        checks: ThemeCheck.recommended,
      },
      {
        fileExists: async (absolutePath) => false,
        getDefaultTranslations: () =>
          Promise.resolve({
            product: {
              title: 'hi',
            },
          }),
      },
    ).then((offenses) => {
      output.value = JSON.stringify(offenses, null, 2);
    });
  } catch (error) {
    // output.value = error.stack || error;
  }
}

function onKeyup(e) {
  if (e.ctrlKey && event.key === 'f') {
    input.value = output.value;
  }
}

async function main() {
  check();
  input.oninput = check;
  input.addEventListener('keyup', onKeyup);
}

main();
