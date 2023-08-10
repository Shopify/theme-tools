import readline from 'readline';

export const confirmProceed = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Do you want to proceed? (Y/n)\n', (answer: string) => {
      rl.close();
      const isAffirmative = answer.toLowerCase() === 'y' || answer === '';
      console.log(isAffirmative ? 'Confirmed, proceeding...\n' : 'Cancelled.\n');
      resolve(isAffirmative);
    });
  });
};
