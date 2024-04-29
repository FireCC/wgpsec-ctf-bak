import web
import pickle
import base64

urls = (
    '/', 'index',
    '/backdoor', 'backdoor'
)
web.config.debug = False
app = web.application(urls, globals())


class index:
    def GET(self):
        return "welcome to the backend!"

class backdoor:
    def POST(self):
        data = web.data()
        # fix this backdoor
        if b"BackdoorPasswordOnlyForAdmin" in data:
            return "You are an admin!"
        else:
            data = base64.b64decode(data)
            pickle.loads(data)
            return "Done!"


if __name__ == "__main__":
    app.run()
