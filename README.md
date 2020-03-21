# JupyterKernelClient

This is a project that allows you to communicate to a jupyter kernel.

## How to use

### Kernel Connection Config
To create a JupyterKernelClient, you will need to create a KernelConfig. This is available as part of this project. An example is below. The key is not currently used in this version of zmq_jupyter.

```
const config: KernelConfig = {
    shell_port: "53794",
    iopub_port: "53795",
    stdin_port: "53796",
    control_port: "53797",
    hb_port: "53798",
    key: "",
    ip: "127.0.0.1",
    transport: "tcp",
    signature_scheme: "",
    kernel_name: ""
}
```

### Kernel Connection Client

```
const j = new JupyterKernelClient(config);
```

### Message Receiver

Most functions made avaible will take in a message reciever to send data to your caller.

```
interface MessageReciever {
    (data: any): void;
};
```


## Functions

### sendShellCommand(command: string, shellMessageReciever: MessageReciever, silent=false)
This function will send a message to the kernel to execute. If this is a python kernel this will be a python command. If silent is set to true, the output will not be returned in the IO Loop.

### sendControlCommand(command: string, controlMessageReciever: MessageReciever, silent=true)
This function will send a message to the kernel to execute. This code will not wait for the shell command channel's to finish executing. This is useful to send commands such as "exit". This will run silently unless told otherwise.


### subscribeToIOLoop(ioMessageReciever: MessageReciever)

This function listens to data coming from the kernel. This function runs indefinitely and is async.

### startSTDINLoop(stdinMessageReciever: MessageReciever)

This function waits for the kernel to send an input request for this client. This function runs indefinitely and is async.

### sendStdinReply(reply: string)

This function is used to send replies once the STDIN loop has requested data from the user.

### checkHeartbeat(heartbeatReciever: MessageReciever)

This function will send a heartbeat check and respond once the kernel sends back the heartbeat. This runs async. Consider using a timer to timeout this call.
