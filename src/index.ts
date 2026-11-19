import { Plugin } from "@opencode/plugin"

/**
 * Declares the plugin id the GUI inherits. The GUI ships no server-side behavior;
 * keeping an explicit id avoids depending on the package-name fallback.
 */
export default Plugin.define({
  id: "nmdra.cache-stats-gui",
  setup() {},
})
