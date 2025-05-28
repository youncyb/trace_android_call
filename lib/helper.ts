import {parse_arg_arrays, parse_args_from_method_name, parse_shadowframe, pretty_method_func, readStdString, } from "./utils"
export function hook_ArtMethod_Invoke(filter: string) {

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
				let method_name = readStdString(pretty_method_func(artmethod_ptr, 1));
        const access_flags = artmethod_ptr.add(4).readU32();

        // 非static函数需要偏移4字节
        if((access_flags & 0x0008) == 0) {
          arg_arrays = arg_arrays.add(4);
        }
				if (method_name?.includes(filter)) {
          console.log("[+] [" + tid + "] ArtMethod::Invoke onEnter:", artmethod_ptr, method_name);
          const { shorty, args_size, long_shorty } = parse_args_from_method_name(method_name);
					if (args_size > 0) {
            let artmethod_args = parse_arg_arrays(arg_arrays, shorty, long_shorty);
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

export function hook_ArtInterpreterToInterpreterBridge(filter: string) {
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

				const { artmethod_ptr: callee_artmethod_ptr, called_args: callee_args, number_of_vregs: callee_number_of_vregs } = parse_shadowframe(args[2]);

				const callee_method_name: any = readStdString(pretty_method_func(callee_artmethod_ptr, 1));
				const { shorty, args_size, long_shorty } = parse_args_from_method_name(callee_method_name);


				if (callee_method_name?.includes(filter)) {
					console.log('-----------------------------------------------------------------------')
					const caller_shadow_frame_ptr = args[2].readPointer();
					if (caller_shadow_frame_ptr.toString() != "0x0") {
						const caller_artmethod_ptr = caller_shadow_frame_ptr.add(Process.pointerSize).readPointer();
						console.log("caller:", readStdString(pretty_method_func(caller_artmethod_ptr, 1)))
					}


					console.log("[+] [" + tid + "] ArtInterpreterToInterpreterBridge onEnter: ", callee_artmethod_ptr, callee_method_name)
					if (args_size > 0) {
						let real_callee_args = callee_args.add((callee_number_of_vregs - args_size) * 4);
						real_callee_args = parse_arg_arrays(real_callee_args, shorty, long_shorty);
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

export function hook_ArtInterpreterToCompiledCodeBridge(filter: string) {
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

				const { artmethod_ptr: callee_artmethod_ptr, called_args: callee_args, number_of_vregs: callee_number_of_vregs } = parse_shadowframe(args[2]);

				const callee_method_name: any = readStdString(pretty_method_func(callee_artmethod_ptr, 1));
				const { shorty, args_size, long_shorty } = parse_args_from_method_name(callee_method_name);


				if (callee_method_name?.includes(filter)) {
					console.log('-----------------------------------------------------------------------')
					if (args[1].toString() !== "0x0") {
						caller_method_name = readStdString(pretty_method_func(args[1], 1));
						console.log("caller:", caller_method_name);
					}


					console.log("[+] [" + tid + "] ArtInterpreterToCompiledCodeBridge onEnter: ", callee_artmethod_ptr, callee_method_name);


					if (args_size > 0) {
						let real_callee_args = callee_args.add((callee_number_of_vregs - args_size) * 4);
						real_callee_args = parse_arg_arrays(real_callee_args, shorty, long_shorty);
						console.log("----------args----------\n", JSON.stringify(real_callee_args), "\n----------end-----------");

					}
				}
			},
			onLeave: function (retval) {

			}
		});

	}
}

export function hook_InvokeWithArgArray(filter: string) {
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
				const tid = args[0].readPointer().add(0x10).readU32()
				const arg_arrays = args[2];
				let method_name = readStdString(pretty_method_func(artmethod_ptr, 1));
				if (method_name?.includes(filter)) {
          const { shorty, args_size, long_shorty } = parse_args_from_method_name(method_name);
					let artmethod_args = parse_arg_arrays(arg_arrays, shorty, long_shorty);
					console.log("[+] [" + tid + "] InvokeWithArgArray onEnter:", artmethod_ptr, method_name);
					if (args_size > 0) {
            const artmethod_args = parse_arg_arrays(arg_arrays, shorty, long_shorty);
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