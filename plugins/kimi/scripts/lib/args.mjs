/**
 * Minimal CLI argument parser.
 * Supports: --flag, --key value, --key=value, positional args
 */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[arg.slice(2)] = argv[i + 1];
        i++;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }
  return { flags, positional };
}
