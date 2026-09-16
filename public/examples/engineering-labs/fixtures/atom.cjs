// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAtomFetcher = createAtomFetcher;
const jotai_1 = require("jotai");
const react_1 = require("react");
function createAtomFetcher(config) {
    if (!config.key) {
        config.key = (...params) => JSON.stringify(params);
    }
    const cache = new Map();
    const format = config.format ?? ((res) => res);
    const getOrCreateAtom = (key) => {
        let a = cache.get(key);
        if (!a) {
            a = (0, jotai_1.atom)({
                loading: false,
                data: config.initialData,
                inited: false,
            });
            cache.set(key, a);
        }
        return a;
    };
    const executeFetch = (a, ...params) => {
        const promise = config
            .fetch(...params)
            .then((res) => format(res))
            .then((data) => {
            const store = (0, jotai_1.getDefaultStore)();
            store.set(a, { data, inited: true, loading: false, loadingPromise: undefined });
            return data;
        })
            .catch((err) => {
            const store = (0, jotai_1.getDefaultStore)();
            store.set(a, (prev) => ({ ...prev, loading: false, loadingPromise: undefined }));
            throw err;
        });
        const store = (0, jotai_1.getDefaultStore)();
        store.set(a, (prev) => ({ ...prev, loading: true, loadingPromise: promise }));
        return promise;
    };
    const tryFetch = (a, ...params) => {
        const store = (0, jotai_1.getDefaultStore)();
        const { loading, inited } = store.get(a);
        if (loading || inited)
            return;
        executeFetch(a, ...params).catch(() => { });
    };
    const forcedRefresh = (a, ...params) => {
        executeFetch(a, ...params).catch(() => { });
    };
    const getData = (...params) => {
        const key = config.key(...params);
        const a = getOrCreateAtom(key);
        const store = (0, jotai_1.getDefaultStore)();
        const { loadingPromise, inited, data } = store.get(a);
        if (loadingPromise)
            return loadingPromise;
        if (inited)
            return Promise.resolve(data);
        return executeFetch(a, ...params);
    };
    const forceGetData = (...params) => {
        const key = config.key(...params);
        const a = getOrCreateAtom(key);
        return executeFetch(a, ...params);
    };
    function useData(...params) {
        const key = config.key(...params);
        const a = getOrCreateAtom(key);
        const state = (0, jotai_1.useAtomValue)(a);
        const paramsRef = (0, react_1.useRef)(params);
        paramsRef.current = params;
        const refresh = (0, react_1.useCallback)(() => {
            forcedRefresh(a, ...paramsRef.current);
        }, [a]);
        const getData = (0, react_1.useCallback)((forceRefresh) => {
            if (forceRefresh) {
                return executeFetch(a, ...paramsRef.current);
            }
            const store = (0, jotai_1.getDefaultStore)();
            const { loadingPromise, inited, data } = store.get(a);
            if (loadingPromise)
                return loadingPromise;
            if (inited)
                return Promise.resolve(data);
            return executeFetch(a, ...paramsRef.current);
        }, [a]);
        (0, react_1.useEffect)(() => {
            tryFetch(a, ...params);
        }, []);
        return { ...state, refresh, getData };
    }
    return { useData, getData, forceGetData };
}
