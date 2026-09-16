// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viteBarrelResolutionPlugin = viteBarrelResolutionPlugin;
const picocolors_1 = require("picocolors");
const vite_plugin_resolve_barrels_1 = require("vite-plugin-resolve-barrels");
function viteBarrelResolutionPlugin(options) {
    const { directories, alias = {}, barrelFiles = ['index.ts', 'api.ts', 'models.ts'], rootDir = 'src', preserveExtensions = false, enable = true, } = options;
    if (enable) {
        console.log(`  ${picocolors_1.default.cyan('resolve-barrels:')} 已启用，可通过 ${picocolors_1.default.yellow('USE_BARREL_RESOLUTION=false')} 关闭`);
    }
    const plugin = (0, vite_plugin_resolve_barrels_1.resolveBarrelsPlugin)({
        directories,
        enable,
        alias,
        barrelFiles,
        rootDir,
        preserveExtensions,
    });
    const dirsPattern = directories.join('|');
    const quickCheck = new RegExp(`from\\s+['\"](?:@(?:src|stores|types|config)/)?(${dirsPattern})(?:/|['\"])`);
    if (plugin.transform) {
        const originalTransform = plugin.transform;
        plugin.transform = function (code, id) {
            if (!quickCheck.test(code))
                return null;
            if (id.includes('node_modules'))
                return null;
            const processedCode = code.replace(/import\s+(\w+)\s*,\s*\{([\s\S]*?)\}\s+from\s+['"]([^'"]*)['"]\s*;?\s*/g, (_match, defaultName, namedImports, importPath) => `import ${defaultName} from '${importPath}';\nimport { ${namedImports} } from '${importPath}';`);
            return originalTransform.call(this, processedCode, id);
        };
    }
    return plugin;
}
