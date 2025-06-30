// ANSI Colors
export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
};
/**
 * Colored console output helpers
 */
export const log = {
  title: (text: any) =>
    console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`),
  success: (text: any) =>
    console.log(`${colors.green}✓ ${text}${colors.reset}`),
  error: (text: any) => console.log(`${colors.red}✗ ${text}${colors.reset}`),
  warning: (text: any) =>
    console.log(`${colors.yellow}⚠ ${text}${colors.reset}`),
  info: (text: any) => console.log(`${colors.blue}ℹ ${text}${colors.reset}`),
  question: (text: any) =>
    console.log(`${colors.magenta}? ${text}${colors.reset}`),
  header: (text: any) =>
    console.log(`${colors.bgBlue}${colors.white} ${text} ${colors.reset}`),
  result: (text: any) =>
    console.log(`${colors.bright}${colors.white}${text}${colors.reset}`),
};

/**
 * Read user input from stdin
 */
export async function readInput(prompt: string): Promise<string> {
  process.stdout.write(prompt);

  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.resume();

    const onData = (data) => {
      process.stdin.pause();
      process.stdin.off("data", onData);
      resolve(data.toString().trim());
    };

    process.stdin.on("data", onData);
  });
}
