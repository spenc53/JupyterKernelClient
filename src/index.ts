import { Subscriber, Request, Dealer } from 'zeromq';
import { v4 as uuid } from 'uuid';

// 'hb' : zmq.REQ,
// 'shell' : zmq.DEALER,
// 'iopub' : zmq.SUB,
// 'stdin' : zmq.DEALER,
// 'control': zmq.DEALER,

export class JupyterKernelClient {
    shell: Dealer;
    ioPub: Subscriber;
    stdin: Dealer;
    control: Dealer;
    heartbeat: Request;


    decoder: TextDecoder = new TextDecoder()

    verbose = false;

    id = uuid();

    constructor(config: KernelConfig) {
        const base_url = `${config.transport}://${config.ip}`;

        this.shell = new Dealer()
        this.shell.routingId = this.id;
        this.shell.connect(`${base_url}:${config.shell_port}`);

        this.ioPub = new Subscriber();
        this.ioPub.connect(`${base_url}:${config.iopub_port}`);
        this.ioPub.subscribe('');

        this.stdin = new Dealer();
        this.stdin.routingId = this.id;
        console.log(`${base_url}:${config.stdin_port}`)
        this.stdin.connect(`${base_url}:${config.stdin_port}`);

        this.control = new Dealer();
        this.control.connect(`${base_url}:${config.control_port}`);

        this.heartbeat = new Request();
        this.heartbeat.connect(`${base_url}:${config.hb_port}`);
    }

    public async subscribeToIOLoop(ioMessageReciever: MessageReciever) {
        while (true) {
            const messages = await this.ioPub.receive();
            const data = this.recvMessage(messages);
            ioMessageReciever(data);
        }
    }

    public async getKernelInfo(shellMessageReciever: MessageReciever) {
        await this.shell.send(this.buildJupyterMessage("kernel_info_request", {}));

        const messages = await this.shell.receive()

        const kernelData = this.recvMessage(messages);
        shellMessageReciever(kernelData);
    }

    public async startSTDINLoop(stdinMessageReciever: MessageReciever) {
        while (true) {
            this.log("waiting for std_in")
            const messages = await this.stdin.receive();
            this.log('recieved std in message')
            this.log('parsing std_in message')
            const data = this.recvMessage(messages);
            this.log('parsed std_in message:')
            this.log(JSON.stringify(data, null, 2));
            stdinMessageReciever(data);
        }
    }

    public async stdinResponse() {
        
    }

    public async sendShellCommand(command: string, shellMessageReciever: MessageReciever) {
        // will this receive data?
        // yes it will
        // do I need to get the message?
        const content = {
            code: command,
            silent: false,
            store_history: true,
            // user_expressions ???,
            allow_stdin: true,
            stop_on_error: true
        }

        const request = this.buildJupyterMessage("execute_request", content)
        await this.shell.send(request);
        const messages = await this.shell.receive()
        const kernelData = this.recvMessage(messages);
        shellMessageReciever(kernelData);
    }

    private recvMessage(messages: Buffer[]): any {
        let thing: JupyterMessage = {};
        let decodedMessages = messages.map((message) => this.decoder.decode(message))

        thing.ids = [];
        let indexOfDelim = decodedMessages.indexOf("<IDS|MSG>");
        for (let i = 0; i < indexOfDelim; i++) {
            thing.ids.push(decodedMessages[i]);
        }
        thing.delimiter = "<IDS|MSG>";
        thing.hmac = decodedMessages[indexOfDelim + 1];
        thing.header = JSON.parse(decodedMessages[indexOfDelim + 2]);
        thing.parent_header = JSON.parse(decodedMessages[indexOfDelim + 3]);
        thing.metadata = JSON.parse(decodedMessages[indexOfDelim + 4]);
        thing.content = JSON.parse(decodedMessages[indexOfDelim + 5]);
        if (indexOfDelim + 6 < messages.length) {
            thing.buffer = messages.reverse()[0]; // what if it doesn't exist?
        }
        return thing.content;
    }

    private buildJupyterMessage(msgType: string, content: any) {
        return [
            this.id,
            "<IDS|MSG>",
            "",
            JSON.stringify(this.getHeader(msgType)),
            "{}",
            "{}",
            JSON.stringify(content)// need to format this properly
        ]
    }

    private getHeader(msgType: string) {
        return {
            msg_id: "1",
            msg_type: msgType
        }
    }

    private log(message: string): void {
        if (this.verbose) {
            console.log(message);
        }
    }

    public setVerbose(verbose: boolean): void {
        this.verbose = verbose;
    }

    public isVerbose(): boolean {
        return this.verbose;
    }
}


export interface JupyterMessage {
    ids?: any[];
    delimiter?: string;
    hmac?: string;
    header?: {};
    parent_header?: {};
    metadata?: {};
    content?: {};
    buffer?: any // not sure what this is
}

export interface KernelConfig {
    shell_port: string;
    iopub_port: string;
    stdin_port: string;
    control_port: string;
    hb_port: string;
    ip: string;
    key: string;
    transport: string;
    signature_scheme: string;
    kernel_name: string;
}

interface MessageReciever {
    (data: any): void;
};


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

function printData(data: any) {
    console.log(JSON.stringify(data, null, 2));
}


const j = new JupyterKernelClient(config);
// j.getKernelInfo(printData);
j.setVerbose(true)
j.sendShellCommand("input()", printData)
j.startSTDINLoop((data) => {
    console.log(JSON.stringify(data, null, 2))
})
j.subscribeToIOLoop((data) => {
    console.log(JSON.stringify(data, null, 2))
});









// security stuff
// https://stackoverflow.com/questions/7480158/how-do-i-use-node-js-crypto-to-create-a-hmac-sha1-hash