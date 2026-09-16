// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseGuard = void 0;
exports.useModelingLicense = useModelingLicense;
exports.consumeModelingLicense = consumeModelingLicense;
exports.createRouteObject = createRouteObject;
const jsx_runtime_1 = require("react/jsx-runtime");
const license_1 = require("@src/appManagement/pages/license");
const models_1 = require("@src/models");
const wsStore_1 = require("@src/stores/wsStore");
const react_1 = require("react");
const LicenseGuard = ({ license, children, }) => {
    const [licenseState, setLicenseState] = (0, react_1.useState)(1);
    (0, react_1.useEffect)(() => {
        wsStore_1.wsStore
            .consumeLicense(license)
            .then((res) => {
            if (res.code === 200) {
                setLicenseState(1);
            }
            else {
                setLicenseState(0);
            }
        })
            .catch(() => {
            setLicenseState(0);
        });
        return () => {
            wsStore_1.wsStore.restoreLicense(license);
        };
    }, []);
    if (licenseState === 0)
        return (0, jsx_runtime_1.jsx)(license_1.NoLicense, {});
    return children;
};
exports.LicenseGuard = LicenseGuard;
function useModelingLicense(frameCode, disabled) {
    const [isAllowed, setIsAllowed] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (disabled) {
            setIsAllowed(true);
            return;
        }
        wsStore_1.wsStore
            .consumeLicense(frameCode)
            .then((res) => {
            if (res.code === 200) {
                setIsAllowed(true);
            }
            else {
                setIsAllowed(false);
            }
        })
            .catch(() => {
            setIsAllowed(false);
        });
        return () => {
            wsStore_1.wsStore.restoreLicense(frameCode);
        };
    }, [disabled, setIsAllowed, frameCode]);
    return isAllowed;
}
function consumeModelingLicense(frameworkId) {
    const key = models_1.ELicenseModuleEnum.DataMetamodelFrameworkFrameworkid.replace('#frameworkId', `#${frameworkId}`);
    return wsStore_1.wsStore.consumeLicense(key).then((res) => {
        if (res.code === 200) {
        }
        else {
            return Promise.reject(false);
        }
    });
}
function createRouteObject({ path, element, license, children, meta }) {
    const item = {
        path,
        element: ((0, jsx_runtime_1.jsx)(exports.LicenseGuard, { license: license, children: element }, license + path)),
        children: children?.map((o) => ({
            path: o.path,
            element: ((0, jsx_runtime_1.jsx)(exports.LicenseGuard, { license: o.license, children: o.element }, o.license + path)),
            meta: o.meta,
        })),
        meta,
    };
    return item;
}
