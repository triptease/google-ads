"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extract = exports.flatten = void 0;
const lodash_1 = __importDefault(require("lodash"));
const long_1 = __importDefault(require("long"));
function longToNumber(value) {
    return parseInt(value.toString(), 10);
}
function flatten(obj) {
    const anyObj = obj;
    if (anyObj instanceof Object && 'value' in anyObj) {
        if (long_1.default.isLong(anyObj.value)) {
            return longToNumber(anyObj.value);
        }
        return anyObj.value;
    }
    if (long_1.default.isLong(anyObj)) {
        return longToNumber(anyObj);
    }
    if (lodash_1.default.isArray(anyObj)) {
        return anyObj.map(flatten);
    }
    if (anyObj instanceof Object) {
        const newObj = {};
        Object.setPrototypeOf(newObj, Object.getPrototypeOf(anyObj));
        lodash_1.default.forOwn(anyObj, (fieldValue, fieldName) => {
            newObj[fieldName] = flatten(fieldValue);
        });
        return newObj;
    }
    return anyObj;
}
exports.flatten = flatten;
function extract(obj, requiredFields = []) {
    const flatObject = flatten(obj);
    requiredFields.forEach(field => {
        const realValue = field in flatObject ? flatObject[field] : undefined;
        if (realValue == null || realValue === undefined) {
            throw new Error(`${field} does not exist on object`);
        }
    });
    return flatObject;
}
exports.extract = extract;
