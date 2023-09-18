import path from 'node:path';
import os from 'node:os';

// This is used to load global checks (in the context where someone installed the CLI globally)
// This shouldn't be used by VS Code since it's baked into the extension with webpack.
export const thisNodeModuleRoot = () => {
  if (process.env.WEBPACK_MODE) {
    return os.tmpdir();
  } else {
    return path.resolve(path.join(__dirname, '..', '..'));
  }
};
