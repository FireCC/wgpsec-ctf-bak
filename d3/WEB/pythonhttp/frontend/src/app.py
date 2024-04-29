from flask import Flask, request, redirect, render_template_string, make_response
import jwt
import json
import http.client

app = Flask(__name__)

login_form = """
<form method="post">
    Username: <input type="text" name="username"><br>
    Password: <input type="password" name="password"><br>
    <input type="submit" value="Login">
</form>
"""

@app.route('/', methods=['GET'])
def index():
    token = request.cookies.get('token')
    if token and verify_token(token):
        return "Hello " + jwt.decode(token, algorithms=["HS256"], options={"verify_signature": False})["username"]
    else: 
        return redirect("/login", code=302)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == "POST":
        user_info = {"username": request.form["username"], "isadmin": False}
        key = get_key("frontend_key")
        token = jwt.encode(user_info, key, algorithm="HS256", headers={"kid": "frontend_key"})
        resp = make_response(redirect("/", code=302))
        resp.set_cookie("token", token)
        return resp
    else:
        return render_template_string(login_form)

@app.route('/backend', methods=['GET', 'POST'])
def proxy_to_backend():
    forward_url = "192.168.121.1:8080"
    conn = http.client.HTTPConnection(forward_url)
    method = request.method
    headers = {key: value for (key, value) in request.headers if key != "Host"}
    data = request.data
    path = "/"
    if request.query_string:
        path += "?" + request.query_string.decode()
    conn.request(method, path, body=data, headers=headers)
    response = conn.getresponse()
    return response.read()

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    token = request.cookies.get('token')
    if token and verify_token(token):
        if request.method == 'POST':
            if jwt.decode(token, algorithms=['HS256'], options={"verify_signature": False})['isadmin']:
                forward_url = "192.168.121.1:8080"
                conn = http.client.HTTPConnection(forward_url)
                method = request.method
                headers = {key: value for (key, value) in request.headers if key != 'Host'}
                data = request.data
                path = "/"
                if request.query_string:
                    path += "?" + request.query_string.decode()
                if headers.get("Transfer-Encoding", "").lower() == "chunked":
                    data = "{}\r\n{}\r\n0\r\n\r\n".format(hex(len(data))[2:], data.decode())
                if "BackdoorPasswordOnlyForAdmin" not in data:
                    return "You are not an admin!"
                conn.request(method, "/backdoor", body=data, headers=headers)
                return "Done!"
            else:
                return "You are not an admin!"
        else:
            if jwt.decode(token, algorithms=['HS256'], options={"verify_signature": False})['isadmin']:
                return "Welcome admin!"
            else:
                return "You are not an admin!"
    else: 
        return redirect("/login", code=302)

def get_key(kid):
    key = ""
    dir = "/app/"
    try:
        with open(dir+kid, "r") as f:
            key = f.read()
    except:
        pass
    print(key)
    return key

def verify_token(token):
    header = jwt.get_unverified_header(token)
    kid = header["kid"]
    key = get_key(kid)
    try:
        payload = jwt.decode(token, key, algorithms=["HS256"])
        return True
    except:
        return False

if __name__ == "__main__":
    app.run(host = "0.0.0.0", port = 8081, debug=False)
