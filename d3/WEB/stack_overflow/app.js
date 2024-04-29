const express = require('express')
const vm = require("vm");

let app = express();
app.use(express.json());
app.use('/static', express.static('static'))

const pie = parseInt(Math.random() * 0xffffffff)

function waf(str) {
    let pattern = /(call_interface)|\{\{.*?\}\}/g;
    return str.match(pattern)
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/index.html")
})

app.post('/', (req, res) => {
    let respond = {}

    let stack = []
    
    let getStack = function (address) {
        if (address - pie >= 0 && address - pie < 0x10000) return stack[address - pie]
        return 0
    }

    let getIndex = function (address) {
        return address - pie
    }

    let read = function (fd, buf, count) {
        let ori = req.body[fd]
        if (ori.length < count) {
            count = ori.length
        }

        if (typeof ori !== "string" && !Array.isArray(ori)) return res.json({"err": "hack!"})

        for (let i = 0; i < count; i++){
            if (waf(ori[i])) return res.json({"err": "hack!"})
            stack[getIndex(buf) + i] = ori[i]
        }
    }

    let write = function (fd, buf, count) {
        if (!respond.hasOwnProperty(fd)) {
            respond[fd] = []
        }
        for (let i = 0; i < count; i++){
            respond[fd].push(getStack(buf + i))   
        }
    }

    let run = function (address) {
        let continuing = 1;
        while (continuing) {
            aaa = getStack(address)
            switch (getStack(address)) {
                
                case "read":
                    let r_fd = stack.pop()
                    let read_addr = stack.pop()
                    if (read_addr.startsWith("{{") && read_addr.endsWith("}}")) {
                        read_addr = pie + eval(read_addr.slice(2,-2).replace("stack", (stack.length - 1).toString()))
                    }
                    read(r_fd, parseInt(read_addr), parseInt(stack.pop()))
                    break;
                case "write":
                    let w_fd = stack.pop()
                    let write_addr = stack.pop()
                    if (write_addr.startsWith("{{") && write_addr.endsWith("}}")) {
                        write_addr = pie + eval(write_addr.slice(2,-2).replace("stack", (stack.length - 1).toString()))
                    }
                    write(w_fd, parseInt(write_addr), parseInt(stack.pop()))
                    break;
                case "exit":
                    continuing = 0;
                    break;
                case "call_interface":
                    let numOfArgs = stack.pop()
                    let cmd = stack.pop()
                    let args = []
                    for (let i = 0; i < numOfArgs; i++) {
                        args.push(stack.pop())
                    }
                    cmd += "('"  + args.join("','") + "')"
                    let result = vm.runInNewContext(cmd)
                    stack.push(result.toString())
                    break;
                case "push":
                    let numOfElem = stack.pop()
                    let elemAddr = parseInt(stack.pop())
                    for (let i = 0; i < numOfElem; i++) {
                        stack.push(getStack(elemAddr + i))
                    }
                    break;
                default:
                    stack.push(getStack(address))
                    break;
            }
            address += 1
        }
    }

    let code = `0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
28
[[ 0 ]]
stdin
read
Started Convertion...
Your input is:
2
[[short - 3]]
stdout
write
5
[[ 0 ]]
stdout
write
...
1
[[short - 2]]
stdout
write
[[ 0 ]]
5
push
(function (...a){  return a.map(char=>char.charCodeAt(0)).join(' ');})
5
call_interface
Ascii is:
1
[[short - 2]]
result
write
1
{{ stack - 2 }}
result
write
Ascii is:
1
[[short - 2]]
stdout
write
1
{{ stack - 3 }}
stdout
write
ok
1
[[short - 2]]
status
write
exit`
    
    code = code.split('\n');
    for (let i = 0; i < code.length; i++){
        stack.push(code[i])
        if (stack[i].startsWith("[[") && stack[i].endsWith("]]")) {
            stack[i] = (pie + eval(stack[i].slice(2,-2).replace("short", i.toString()))).toString()
        }
    }
    run(pie + 0)
    return res.json(respond)
})

app.listen(3090, () => {
    console.log("listen on 3090");
})
