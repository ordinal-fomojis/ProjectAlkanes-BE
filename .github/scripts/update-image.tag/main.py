import os

import yaml

FILE_PATH = 'iac/kubernetes/shovel-be/values.yaml'
IMAGE_TAG = os.getenv('IMAGE_TAG')
ENVIRONMENTS = os.getenv('ENVIRONMENTS').split(',')

def main():
  with open(FILE_PATH, 'r') as f:
    values = yaml.safe_load(f)

  for env_name in ENVIRONMENTS:
    environment = [env for env in values['environments'] if env['name'] == env_name][0]
    environment['tag'] = IMAGE_TAG

  with open(FILE_PATH, 'w') as f:
    yaml.safe_dump(values, f)


if __name__ == '__main__':
  main()
