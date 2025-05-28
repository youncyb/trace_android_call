function find_func(so_name: string, export_name: string, ret_type: any, args_type: any): NativeFunction<NativeFunctionReturnValue, []> | null {
	let addr = Module.findExportByName(so_name, export_name);
	let called_name = null;
	if (addr) {
		called_name = new NativeFunction(addr, ret_type, args_type);
	}
	return called_name;
}

function stringToHexCharCode(str: string | null) {
	if(str === null) {
		return '';
	}
    let hexString = '';
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        hexString += charCode.toString(16).padStart(4, '0'); // Pad to 4 digits for UTF-16 characters
    }
    return hexString.toUpperCase(); // Convert to uppercase for consistency
}

export function readStdString(pointers: NativePointer[]): string | null {
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

export function parse_arg_arrays(arg_arrays: NativePointer, shorty: string, long_shorty: string[]) {
	let result: any = {};
	let count = 0
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
				result[`arg${j}`] = "0x" + arg_arrays.add(count).readU32().toString(16)
				if (i === 'L' && long_shorty[j] == "java.lang.String") {
					// java.lang.String C++ mirror 偏移 16字节
					try {
						// 字符串指针
						const text_ptr = ptr(result[`arg${j}`]).add(0x10);

						let text = null;
						// 字符串长度
						const count_ = ptr(result[`arg${j}`]).add(0x8).readU32();
						
						if((count_ & 1) == 0) {
							// compressed type
							text = text_ptr.readCString(count_ >> 1);
						}
						else {
							text = text_ptr.readUtf16String(count_ >> 1)
						}
						

						// console.log("count_", count_, hexdump(ptr(result[`arg${j}`])));
						result[`arg${j}`] = {"addr": result[`arg${j}`], "text": text, "hex": stringToHexCharCode(text)}
					} catch (error) {
						console.log(error)
					}
					
				}
				count += 4;
				j += 1;
				break;
			case 'D':
			case 'J':
				result[`arg${j}`] = "0x" + arg_arrays.add(count).readU64().toString(16)
				count += 8
				j += 1;
				break;
			case 'V':
				break;
			default:
				console.log("error shorty:", i);
				break
		}
	}
	return result;
}

export function parse_args_from_method_name(method_name: string) {
	const start = method_name.indexOf("(");
	const end = method_name.indexOf(")");
	const args = method_name.slice(start + 1, end);
	let long_shorty: string[] = []
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

export function parse_shadowframe(shadowframe_ptr: NativePointer) {
	const artmethod_ptr = shadowframe_ptr.add(Process.pointerSize).readPointer();
	const number_of_vregs = shadowframe_ptr.add(Process.pointerSize * 6).readU32();
	const vregs_ = shadowframe_ptr.add(Process.pointerSize * 6 + 16);
	return { "artmethod_ptr": artmethod_ptr, "called_args": vregs_, "number_of_vregs": number_of_vregs };
}

export let pretty_method_func: any = find_func("libart.so", "_ZN3art9ArtMethod12PrettyMethodEb", ["pointer", "pointer", "pointer"], ["pointer", "bool"]);
