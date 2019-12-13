import { Subscriber, Request, Dealer } from 'zeromq';

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

    constructor() {
        this.shell = new Dealer()
        this.shell.connect("tcp://127.0.0.1:53794");

        this.ioPub = new Subscriber();
        this.ioPub.connect("tcp://127.0.0.1:53795");
        this.ioPub.subscribe('');

        this.stdin = new Dealer();
        this.control = new Dealer();
        this.heartbeat = new Request();
    }

    recv_message(messages: Buffer[]) {
        for (const message of messages) {
            console.log(this.decoder.decode(message))
        }
    }

    async ioPubLoop() {
        while (true) {
            const messages = await this.ioPub.receive();
            this.recv_message(messages);
        }
    }

    async getKernelInfo() {
        const data = {
            msgType: 'kernel_info_request',
            content: {}
        }
        console.log('request for kernel_info')
        await this.shell.send([
            "<IDS|MSG>",
            "",
            JSON.stringify(this.getHeader()),
            "{}",
            "{}",
            "{}"
        ]);

        const messages = await this.shell.receive()

        this.recv_message(messages);
    }

    getHeader() {
        return {
            msg_id: "1",
            msg_type: "kernel_info_request"
        }
    }
}

interface KernelConfig {
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
