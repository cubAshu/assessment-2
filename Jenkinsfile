pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 10, unit: 'MINUTES')
  }

  environment {
    APP = 'samplejson'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script { env.TAG = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim() }
        echo "Building ${env.APP}:${env.TAG}"
      }
    }

    stage('Check code') {
      // Node is not installed on this VM, so borrow it from a container
      steps { sh 'docker run --rm -v "$PWD":/app -w /app node:20-alpine node --check server.js' }
    }

    stage('Build image') {
      steps { sh 'docker build -t $APP:$TAG -t $APP:latest .' }
    }

    stage('Smoke test') {
      // start the real image and ask it for /health before trusting it
      steps {
        sh '''
          docker rm -f smoke-$BUILD_NUMBER >/dev/null 2>&1 || true
          docker run -d --name smoke-$BUILD_NUMBER $APP:$TAG
          for i in $(seq 1 15); do
            if docker exec smoke-$BUILD_NUMBER wget -qO- http://127.0.0.1:3000/health | grep -q '"ok"'; then
              echo "container answered /health"; exit 0
            fi
            sleep 2
          done
          echo "container never answered /health"; docker logs smoke-$BUILD_NUMBER; exit 1
        '''
      }
    }
  }

  post {
    always  { sh 'docker rm -f smoke-$BUILD_NUMBER >/dev/null 2>&1 || true' }
    success { echo "Built ${env.APP}:${env.TAG}" }
    failure { echo 'Failed: open Console Output and read the first red error' }
  }
}
