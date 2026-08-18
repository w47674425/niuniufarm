// 通用小工具

export function rand(a, b) { return a + Math.random() * (b - a); }

export function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

export function $(id) { return document.getElementById(id); }
