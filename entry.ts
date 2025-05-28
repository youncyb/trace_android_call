import { hook_ArtInterpreterToCompiledCodeBridge, hook_ArtInterpreterToInterpreterBridge, hook_ArtMethod_Invoke, hook_InvokeWithArgArray } from "./lib/helper";

export function hook_java() {
    Java.perform(function () {
        let MainActivity = Java.use("com.example.myapplication.MainActivity");
        Java.choose("com.example.myapplication.MainActivity", {
            onMatch: function(instance) {
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
    
    hook_ArtInterpreterToInterpreterBridge(filter);
    hook_ArtInterpreterToCompiledCodeBridge(filter);
    hook_InvokeWithArgArray(filter);
}

setImmediate(main);