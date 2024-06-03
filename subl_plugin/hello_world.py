import sublime
import sublime_plugin

import requests
from threading import Timer


class ExampleCommand(sublime_plugin.TextCommand):
	def run(self, edit):
		self.view.insert(edit, 0, "Hello, World!")


class AutoSaveListener(sublime_plugin.EventListener):

	base_url = "http://localhost:3030"
	changed = True
	delay_field = 1

	def on_load(self, view): 
		full_file_name = view.file_name()
		root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
		relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

		# curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"
		url = f"{self.base_url}/loadfile"
		request_body = {
			"filePath": relative_file_name,
			"rootPath": root_name
		}
		print(request_body)
		response = requests.post(url = url, json = request_body)

		print(response.text)
		return

	def on_modified(self, view):
		def updateFile():
			if self.changed:

				full_file_name = view.file_name()
				if "example-code" in full_file_name and view.is_dirty() and not view.is_loading():
					root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
					relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

					# curl -X POST http://localhost:3000/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"import os\nos.sys.arg\nprint(\"Hello World!\")\n"}'

					url = f"{self.base_url}/updateFile"
					request_body = {
						"filePath": relative_file_name,
						"rootPath": root_name,
						"content": view.substr(sublime.Region(0, view.size()))
					}
					print(request_body)
					 
					response = requests.post(url = url, json = request_body)					 
					# extracting data in json format
					print(response)
					if response.status_code == 200:
						view.run_command("save")
			# else:
				# self.changed = False


		# self.changed = True
		Timer(self.delay_field, updateFile).start()