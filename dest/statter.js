"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpStatter = void 0;
class NoOpStatter {
    gauge(name, value, tags) { }
    increment(name, value, tags) { }
    histogram(name, value, tags) { }
}
exports.NoOpStatter = NoOpStatter;
