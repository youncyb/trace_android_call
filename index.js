/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 704:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.pretty_method_func = void 0;
exports.readStdString = readStdString;
exports.parse_arg_arrays = parse_arg_arrays;
exports.parse_args_from_method_name = parse_args_from_method_name;
exports.parse_shadowframe = parse_shadowframe;
function find_func(so_name, export_name, ret_type, args_type) {
    let addr = Module.findExportByName(so_name, export_name);
    let called_name = null;
    if (addr) {
        called_name = new NativeFunction(addr, ret_type, args_type);
    }
    return called_name;
}
function stringToHexCharCode(str) {
    if (str === null) {
        return '';
    }
    let hexString = '';
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        hexString += charCode.toString(16).padStart(4, '0'); // Pad to 4 digits for UTF-16 characters
    }
    return hexString.toUpperCase(); // Convert to uppercase for consistency
}
function readStdString(pointers) {
    let str = Memory.alloc(Process.pointerSize * 3);
    str.writePointer(pointers[0]);
    let isTiny = (str.readU8() & 1) === 0;
    if (isTiny) {
        str.add(Process.pointerSize * 1).writePointer(pointers[1]);
        str.add(Process.pointerSize * 2).writePointer(pointers[2]);
        return str.add(1).readUtf8String();
    }
    else {
        return pointers[2].readUtf8String();
    }
}
function parse_arg_arrays(arg_arrays, shorty, long_shorty) {
    let result = {};
    let count = 0;
    let j = 0;
    let tmp_shorty = shorty.slice(1);
    for (let i of tmp_shorty) {
        switch (i) {
            case 'Z':
            case 'B':
            case 'C':
            case 'S':
            case 'I':
            case 'F':
            case 'L':
                result[`arg${j}`] = "0x" + arg_arrays.add(count).readU32().toString(16);
                if (i === 'L' && long_shorty[j] == "java.lang.String") {
                    // java.lang.String C++ mirror 偏移 16字节
                    try {
                        // 字符串指针
                        const text_ptr = ptr(result[`arg${j}`]).add(0x10);
                        let text = null;
                        // 字符串长度
                        const count_ = ptr(result[`arg${j}`]).add(0x8).readU32();
                        if ((count_ & 1) == 0) {
                            // compressed type
                            text = text_ptr.readCString(count_ >> 1);
                        }
                        else {
                            text = text_ptr.readUtf16String(count_ >> 1);
                        }
                        // console.log("count_", count_, hexdump(ptr(result[`arg${j}`])));
                        result[`arg${j}`] = { "addr": result[`arg${j}`], "text": text, "hex": stringToHexCharCode(text) };
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
                count += 4;
                j += 1;
                break;
            case 'D':
            case 'J':
                result[`arg${j}`] = "0x" + arg_arrays.add(count).readU64().toString(16);
                count += 8;
                j += 1;
                break;
            case 'V':
                break;
            default:
                console.log("error shorty:", i);
                break;
        }
    }
    return result;
}
function parse_args_from_method_name(method_name) {
    const start = method_name.indexOf("(");
    const end = method_name.indexOf(")");
    const args = method_name.slice(start + 1, end);
    let long_shorty = [];
    if (args.length == 0) {
        return { "shorty": "V", "args_size": 0, "long_shorty": long_shorty };
    }
    let shorty = "V";
    let args_size = 0;
    for (let key of args.split(",")) {
        key = key.trim().replace("[", "").replace("]", "");
        long_shorty.push(key);
        switch (key) {
            case "int":
                shorty += "I";
                args_size += 1;
                break;
            case "double":
                shorty += "D";
                args_size += 2;
                break;
            case "char":
                shorty += "C";
                args_size += 1;
                break;
            case "boolean":
                shorty += "Z";
                args_size += 1;
                break;
            case "long":
                shorty += "J";
                args_size += 2;
                break;
            case "float":
                shorty += "F";
                args_size += 1;
                break;
            case "short":
                shorty += "S";
                args_size += 1;
                break;
            case "byte":
                shorty += "B";
                args_size += 1;
                break;
            default:
                shorty += "L";
                args_size += 1;
                break;
        }
    }
    return { "shorty": shorty, "args_size": args_size, "long_shorty": long_shorty };
}
function parse_shadowframe(shadowframe_ptr) {
    const artmethod_ptr = shadowframe_ptr.add(Process.pointerSize).readPointer();
    const number_of_vregs = shadowframe_ptr.add(Process.pointerSize * 6).readU32();
    const vregs_ = shadowframe_ptr.add(Process.pointerSize * 6 + 16);
    return { "artmethod_ptr": artmethod_ptr, "called_args": vregs_, "number_of_vregs": number_of_vregs };
}
exports.pretty_method_func = find_func("libart.so", "_ZN3art9ArtMethod12PrettyMethodEb", ["pointer", "pointer", "pointer"], ["pointer", "bool"]);


/***/ }),

/***/ 837:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hook_ArtMethod_Invoke = hook_ArtMethod_Invoke;
exports.hook_ArtInterpreterToInterpreterBridge = hook_ArtInterpreterToInterpreterBridge;
exports.hook_ArtInterpreterToCompiledCodeBridge = hook_ArtInterpreterToCompiledCodeBridge;
exports.hook_InvokeWithArgArray = hook_InvokeWithArgArray;
const utils_1 = __webpack_require__(704);
function hook_ArtMethod_Invoke(filter) {
    let module = Process.findModuleByName("libart.so");
    let symbols = module ? module.enumerateSymbols() : [];
    let addr_artmethod_invoke = null;
    for (let symbol of symbols) {
        if (symbol.name.indexOf("_ZN3art9ArtMethod6InvokeEPNS_6ThreadEPjjPNS_6JValueEPKc") >= 0) {
            addr_artmethod_invoke = symbol.address;
            console.log(addr_artmethod_invoke, symbol.name);
            break;
        }
    }
    if (addr_artmethod_invoke) {
        Interceptor.attach(addr_artmethod_invoke, {
            onEnter: function (args) {
                const artmethod_ptr = args[0];
                const tid = args[1].add(0x10).readU32();
                let arg_arrays = args[2];
                let method_name = (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(artmethod_ptr, 1));
                const access_flags = artmethod_ptr.add(4).readU32();
                // 非static函数需要偏移4字节
                if ((access_flags & 0x0008) == 0) {
                    arg_arrays = arg_arrays.add(4);
                }
                if (method_name?.includes(filter)) {
                    console.log("[+] [" + tid + "] ArtMethod::Invoke onEnter:", artmethod_ptr, method_name);
                    const { shorty, args_size, long_shorty } = (0, utils_1.parse_args_from_method_name)(method_name);
                    if (args_size > 0) {
                        let artmethod_args = (0, utils_1.parse_arg_arrays)(arg_arrays, shorty, long_shorty);
                        console.log("----------args----------\n", JSON.stringify(artmethod_args), "\n----------end-----------");
                    }
                    console.log("\nBacktrace infomations: \n" + Thread.backtrace(this.context, Backtracer.ACCURATE).map(DebugSymbol.fromAddress).join("\n") + "\n");
                }
            },
            onLeave: function (retval) {
            }
        });
    }
}
function hook_ArtInterpreterToInterpreterBridge(filter) {
    let module = Process.findModuleByName("libart.so");
    let symbols = module ? module.enumerateSymbols() : [];
    let addr_ = null;
    for (let symbol of symbols) {
        if (symbol.name.indexOf("_ZN3art11interpreter33ArtInterpreterToInterpreterBridgeEPNS_6ThreadERKNS_20CodeItemDataAccessorEPNS_11ShadowFrameEPNS_6JValueE") >= 0) {
            addr_ = symbol.address;
            break;
        }
    }
    if (addr_) {
        Interceptor.attach(addr_, {
            onEnter: function (args) {
                const tid = args[0].add(0x10).readU32();
                const { artmethod_ptr: callee_artmethod_ptr, called_args: callee_args, number_of_vregs: callee_number_of_vregs } = (0, utils_1.parse_shadowframe)(args[2]);
                const callee_method_name = (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(callee_artmethod_ptr, 1));
                const { shorty, args_size, long_shorty } = (0, utils_1.parse_args_from_method_name)(callee_method_name);
                if (callee_method_name?.includes(filter)) {
                    console.log('-----------------------------------------------------------------------');
                    const caller_shadow_frame_ptr = args[2].readPointer();
                    if (caller_shadow_frame_ptr.toString() != "0x0") {
                        const caller_artmethod_ptr = caller_shadow_frame_ptr.add(Process.pointerSize).readPointer();
                        console.log("caller:", (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(caller_artmethod_ptr, 1)));
                    }
                    console.log("[+] [" + tid + "] ArtInterpreterToInterpreterBridge onEnter: ", callee_artmethod_ptr, callee_method_name);
                    if (args_size > 0) {
                        let real_callee_args = callee_args.add((callee_number_of_vregs - args_size) * 4);
                        real_callee_args = (0, utils_1.parse_arg_arrays)(real_callee_args, shorty, long_shorty);
                        console.log("----------args----------\n", JSON.stringify(real_callee_args), "\n----------end-----------");
                    }
                    // console.log("\nBacktrace infomations: \n" + Thread.backtrace(this.context, Backtracer.ACCURATE).map(DebugSymbol.fromAddress).join("\n") + "\n");
                }
            },
            onLeave: function (retval) {
            }
        });
    }
}
function hook_ArtInterpreterToCompiledCodeBridge(filter) {
    let module = Process.findModuleByName("libart.so");
    let symbols = module ? module.enumerateSymbols() : [];
    let addr_ = null;
    for (let symbol of symbols) {
        if (symbol.name.indexOf("_ZN3art11interpreter34ArtInterpreterToCompiledCodeBridgeEPNS_6ThreadEPNS_9ArtMethodEPNS_11ShadowFrameEtPNS_6JValueE") >= 0) {
            addr_ = symbol.address;
            break;
        }
    }
    if (addr_) {
        Interceptor.attach(addr_, {
            onEnter: function (args) {
                const tid = args[0].add(0x10).readU32();
                let caller_method_name = null;
                const { artmethod_ptr: callee_artmethod_ptr, called_args: callee_args, number_of_vregs: callee_number_of_vregs } = (0, utils_1.parse_shadowframe)(args[2]);
                const callee_method_name = (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(callee_artmethod_ptr, 1));
                const { shorty, args_size, long_shorty } = (0, utils_1.parse_args_from_method_name)(callee_method_name);
                if (callee_method_name?.includes(filter)) {
                    console.log('-----------------------------------------------------------------------');
                    if (args[1].toString() !== "0x0") {
                        caller_method_name = (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(args[1], 1));
                        console.log("caller:", caller_method_name);
                    }
                    console.log("[+] [" + tid + "] ArtInterpreterToCompiledCodeBridge onEnter: ", callee_artmethod_ptr, callee_method_name);
                    if (args_size > 0) {
                        let real_callee_args = callee_args.add((callee_number_of_vregs - args_size) * 4);
                        real_callee_args = (0, utils_1.parse_arg_arrays)(real_callee_args, shorty, long_shorty);
                        console.log("----------args----------\n", JSON.stringify(real_callee_args), "\n----------end-----------");
                    }
                }
            },
            onLeave: function (retval) {
            }
        });
    }
}
function hook_InvokeWithArgArray(filter) {
    let module = Process.findModuleByName("libart.so");
    let symbols = module ? module.enumerateSymbols() : [];
    let addr_ = null;
    for (let symbol of symbols) {
        if (symbol.name.indexOf("InvokeWithArgArray") >= 0) {
            addr_ = symbol.address;
            break;
        }
    }
    if (addr_) {
        Interceptor.attach(addr_, {
            onEnter: function (args) {
                const artmethod_ptr = args[1];
                const tid = args[0].readPointer().add(0x10).readU32();
                const arg_arrays = args[2];
                let method_name = (0, utils_1.readStdString)((0, utils_1.pretty_method_func)(artmethod_ptr, 1));
                if (method_name?.includes(filter)) {
                    const { shorty, args_size, long_shorty } = (0, utils_1.parse_args_from_method_name)(method_name);
                    let artmethod_args = (0, utils_1.parse_arg_arrays)(arg_arrays, shorty, long_shorty);
                    console.log("[+] [" + tid + "] InvokeWithArgArray onEnter:", artmethod_ptr, method_name);
                    if (args_size > 0) {
                        const artmethod_args = (0, utils_1.parse_arg_arrays)(arg_arrays, shorty, long_shorty);
                        console.log("----------args----------\n", JSON.stringify(artmethod_args), "\n----------end-----------");
                    }
                    // console.log("\nBacktrace infomations: \n" + Thread.backtrace(this.context, Backtracer.ACCURATE).map(DebugSymbol.fromAddress).join("\n") + "\n");
                }
            },
            onLeave: function (retval) {
            }
        });
    }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hook_java = hook_java;
const helper_1 = __webpack_require__(837);
function hook_java() {
    Java.perform(function () {
        let MainActivity = Java.use("com.example.myapplication.MainActivity");
        Java.choose("com.example.myapplication.MainActivity", {
            onMatch: function (instance) {
                instance.Java_method_hello2(2, 2);
            },
            onComplete() {
            },
        });
    });
}
function main() {
    const filter = "com.example";
    // hook_ArtMethod_Invoke(filter);
    (0, helper_1.hook_ArtInterpreterToInterpreterBridge)(filter);
    (0, helper_1.hook_ArtInterpreterToCompiledCodeBridge)(filter);
    (0, helper_1.hook_InvokeWithArgArray)(filter);
}
setImmediate(main);

})();

this.MyFridaAgent = __webpack_exports__;
/******/ })()
;