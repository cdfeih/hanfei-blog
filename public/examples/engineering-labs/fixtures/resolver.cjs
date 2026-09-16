// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolverBuilder = ResolverBuilder;
const path_1 = require("path");
function transformImport(code, name, libPath, pathMap) {
    const importRegex = new RegExp(`import\\s+\\{\\s*([^}]+)\\s*\\}\\s+from\\s+['"]@mbse-unity/${name}['"]`, 'g');
    return code.replace(importRegex, (fullMatch, importsContent) => {
        const importList = importsContent.split(',').map((item) => item.trim());
        const groupedByPath = {};
        for (const name of importList) {
            const actualName = name.split(/\s+as\s+/)[0].trim();
            const path = pathMap[actualName];
            if (path) {
                if (!groupedByPath[path]) {
                    groupedByPath[path] = [];
                }
                groupedByPath[path].push(name);
            }
        }
        const importStatements = [];
        for (const [pathName, names] of Object.entries(groupedByPath)) {
            importStatements.push(`import { ${names.join(', ')} } from '${path_1.default.join(libPath, pathName).replace(/\\/g, '/')}'`);
        }
        return importStatements.join('\n');
    });
}
function ResolverBuilder(name, libPath, pathMap) {
    const moduleName = `@mbse-unity/${name}`;
    return () => ({
        name: `${name}-resolver`,
        enforce: 'pre',
        apply: 'serve',
        transform(code, id) {
            if (!code.includes(moduleName)) {
                return null;
            }
            return {
                code: transformImport(code, name, libPath, pathMap),
                map: null,
            };
        },
    });
}
