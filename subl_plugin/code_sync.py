import sublime
import sublime_plugin

import requests
from threading import Timer


class AutoSyncListener(sublime_plugin.EventListener):

	base_url = "http://localhost"
	# changed = True
	delay_field = 0.5

	def on_load(self, view): 
		print("tcui")
		print(view.window().settings().get('code_sync_on'))
		if view.window().settings().get('code_sync_on'):
			print("tcui 2")
			print(view.window().settings().get('code_sync_on'))
			full_file_name = view.file_name()
			root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
			relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

			# curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"
			url = f"{self.base_url}:{view.window().settings().get('port')}/openfile"
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
			# if self.changed:
			if view.is_dirty() and not view.is_loading():
				full_file_name = view.file_name()
				root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
				relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

				# curl -X POST http://localhost:3000/updateFile -H "Content-Type: application/json" -d '{"filePath":"hello_world.py","content":"import os\nos.sys.arg\nprint(\"Hello World!\")\n"}'
				url = f"{self.base_url}:{view.window().settings().get('port')}/updatefile"
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
		if view.window().settings().get('code_sync_on'):
			print(view.window().settings().get('code_sync_on'))
			# self.changed = True
			Timer(self.delay_field, updateFile).start()

	def on_post_save(self, view):
		if view.window().settings().get('code_sync_on'):
			full_file_name = view.file_name()
			print(full_file_name)
			print(view.window().folders())
			root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
			relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

			# curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"
			url = f"{self.base_url}:{view.window().settings().get('port')}/createfile"
			request_body = {
				"filePath": relative_file_name,
			}
			print(request_body)
			response = requests.post(url = url, json = request_body)

			print(response.text)
			return

	def on_pre_close(self, view):
		if view.window().settings().get('code_sync_on') and not view.window().settings().get('save_changes'):
			print(view.window().settings().get('code_sync_on'))
			full_file_name = view.file_name()
			print(full_file_name)
			root_name = list(filter(lambda folder: folder in full_file_name, view.window().folders()))[0]
			relative_file_name = full_file_name.replace(root_name, "").lstrip('/')

			url = f"{self.base_url}:{view.window().settings().get('port')}/closefile"
			request_body = {
				"filePath": relative_file_name,
			}
			print(request_body)
			response = requests.post(url = url, json = request_body)

			print(response.text)
			return

	def on_new_window(self, window):
		# open server
		pass

	def on_pre_close_window(self, window):
		# settings = sublime.load_settings('Preferences.sublime-settings')
		# save changes
		# turn off code sync
		if window.settings().get('code_sync_on'):

			window.run_command('stop_code_sync')
		# close server

class LaunchCodeSyncCommand(sublime_plugin.WindowCommand):
    def run(self, port=3000, is_server=True, save_changes = False):
    	window_settings = self.window.settings()
    	# global_settings = sublime.load_settings('Preferences.sublime-settings')

    	# code_sync_on_setting = window_settings.get('code_sync_on', True)
    	window_settings.set('code_sync_on', True)
    	window_settings.set('save_changes', save_changes)

    	# settings.set('code_sync_on', True)
    	# settings.set('port', port)

    	# port_setting = window_settings.get('port', port)
    	window_settings.set('port', port)

        # root_dir = self.window.folders()[0]
        # save_path = root_dir + "/" + name
        # print(save_path)
        # open(save_path, "a").close()

class StopCodeSyncCommand(sublime_plugin.WindowCommand):
    def run(self, port=3000, is_server=True, save_changes = False):
    	window_settings = self.window.settings()
    	# settings = sublime.load_settings('Preferences.sublime-settings')
    	window_settings.set('code_sync_on', False)
    	window_settings.set('save_changes', save_changes)
    	window_settings.set('port', port)

class CustomCreateFileCommand(sublime_plugin.WindowCommand):
    def run(self, filePath):
    	window_settings = self.window.settings()
    	if window_settings.get('code_sync_on'):
    		# curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"
    		url = f"http://localhost:{window_settings.get('port')}/createfile"
    		request_body = {
    			"filePath": filePath,
    		}
    		print(request_body)
    		response = requests.post(url = url, json = request_body)
    		print(response.text)

class CustomDeleteFileCommand(sublime_plugin.WindowCommand):
    def run(self, filePath):
    	window_settings = self.window.settings()
    	if window_settings.get('code_sync_on'):
    		# curl -X POST http://localhost:3000/loadfile -d "filePath=hello_world.py"
    		url = f"http://localhost:{window_settings.get('port')}/deletefile"
    		request_body = {
    			"filePath": filePath,
    		}
    		print(request_body)
    		response = requests.post(url = url, json = request_body)
    		print(response.text)

