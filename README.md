# Introduccion a Kubernetes

## Nivelación

[Presentacion](https://docs.google.com/presentation/d/1z1AW6JPWl381OLqKR2f9Sr8_lVQiufjjzWbEsK5pZMM)

## Como utilizar

Para entender mejor este ejemplo te recomiendo viajar entre los Commits.

para viajar en el tiempo a traves de los commits debes tomar los 7 caracteres de cada commit que viene aca abajo y ejecutar:

```sh
    git checkout XXXXXXX #(dc0f9d8 por ejemplo)
```

__commit dc0f9d8__
1 - App Base

Nada que decir, esta es tu app y corre en tu pc con

```sh  
    npm install
    #esperar unos segundos y ejecutar con
    node server.js
```
y el código es mas o menos así

```js
    var express = require('express');
    var app = express();

    app.get('/', function (req, res) {
        res.send('Hola Perro!');
    });

    app.listen(8080, function () {
        console.log('Listos en el 8080');
    });
```
Pero como vimos en la presentación lo que gobierna el mundo hoy es Docker asi que veamos como montar nuestro servicio en docker asi que vamos al siguiente commit.

__commit 2dbad3a__
2 - Dockerfile
Creamos el Dockerfile y ya tenemos nuestra App en un container.

```Dockerfile
    FROM node:alpine

    WORKDIR /app
    COPY . .
    RUN npm i
    EXPOSE 8080
    CMD  ["node", "server.js"]
```
Excelente ya tenemos el Docker pero lo que queremos es que esto corra en la Nube asi que vamos al siguiente commit y veamos que necesitamos tener para hacer que nuestro servicio reciba trafico.


__commit d9b1e1d__
3 - Creamos el Balanceador de carga

Aqui entramos en el mundo de Kuberneres.

Creamos un service de tipo LoadBalancer que va a ser la puerta de entrada a nuestro servicio y se va a encargar de distribuir los request entre los nodos.

```yaml
    kind: Service
    apiVersion: v1
    metadata:
    name: lb
    spec:
    selector:
        app: servicio

    #Lo realmente importante esta aca
    ports:
        - protocol: TCP
        port: 80
        targetPort: 8080

    #El tipo puede variar
    type: LoadBalancer
```
Para crear este balanceador dentro de GCP y que apunte al servicio dentro de nuestro cluster basta con ejecutar:

```sh
    kubectl apply -f service-load-balancer.yaml
```
Lo interesante esta por venir, vamos al siguiente commit.

__commit b77b4db__
4 - Creamos el Deployment

Quien se va a encargar de llevar nuestro contenedor a Kubernetes y crear las replicas necesarias es el Deployment.

Pero antes tenemos que subir nuestro App "empaquetada" en Docker y dejarla en el Google Cloud Regitry de nuestro proyecto. Para ello debemos "Tagear" la imagen con docker poniendo como tag la url que tendra la imagen una vez que se suba al registry de Google en tu proyecto.

```sh
    docker build -t "gcr.io/MY-PROYECTO-GCP/servicio:1" .
```

Y con el siguiente comando subimos la imagen tageada al registry.

```sh
    gcloud docker -- push -- gcr.io/MY-PROYECTO-GCP/servicio:1
```

__-t__ para decir que vamos a tagear
__gcr.io__ es el dominio que mediante el cual Google expone las imágenes (Es accesible solo dentro del proyecto por defecto, si se desea abrir al mundo se debe dar permisos al Google Cloud Storage que crea para almacenar estas imagenes en el proyecto).
__.__ para decir que el Dockerfile esta en el directorio actual


```yaml
    apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
    name: servicio
    spec:
    # La mágia comienza acá
    replicas: 3

    template:
        metadata:
        labels:
            app: servicio
        spec:
    # y acá
        containers:
    # Puede ser una lista de contenedores en un POD
            - name: servicio
            image: "gcr.io/MY-PROYECTO-GCP/servicio:1"
            ports:
                - name: http
                containerPort: 8080
```
Para aplicar esta configuración en nuestro cluster basta con escribir.

```sh
    kubectl apply -f deployment.yaml
```

Ya puedes probar tu servicio veamos que IP se asigno.

```sh
    kubectl get services
```
Fijate la IP que te asigno y puedes abrirla en el browser o hacer un curl a lo macho.

```sh
    curl http://<LA IP DEL BALACEADOR>/
```
Pero hagamos esto un poco mas interesante, entendamos como funciona el balanceo a nivel de Nodos y el balanceo a nivel de Pods (replicas)
para eso vamos al siguiente commit.

__commit d9c0028__
5 - Exponemos el nombre de cada pod como variable de entorno.

```yaml
    apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
    name: servicio
    spec:
    # La mágia comienza acá
    replicas: 3

    template:
        metadata:
        labels:
            app: servicio
        spec:
    # y acá
        containers:
    # Puede ser una lista de contenedores en un POD
            - name: servicio
            image: "gcr.io/gdgscl/servicio:4"
            ports:
                - name: http
                containerPort: 8080
    # Veamos que Pod nos responde al Balancear - Ver server.js              
            env:
                - name: MY_NODE_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: spec.nodeName

                    
                - name: MY_POD_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: metadata.name
```
Para aplicar esta configuración en nuestro cluster basta con escribir.

```sh
    kubectl apply -f deployment.yaml
```

Y las leemos desde nuestro server.js
```js
    app.get('/', function (req, res) {
        res.send({
            nodo: process.env.MY_NODE_NAME,
            pod: process.env.MY_POD_NAME
        });
    });
```
Esto va a responder con el nombre del Nodo (la maquina virtual) y del Pod (Cada una de las preplicas de nuestro servicio).

Quieres ver algo hermoso, ejecuta este comando y veras como funciona el valanceo en los dos niveles.

```sh
    while true; do sleep 0.1; curl http://<LA IP DEL BALACEADOR>/; echo -e '\n';done
```
ya tienes una configuracion básica de tu servicio. Veamos algunos conceptos que le darán más robustes a tu solucion en el siguiente commit.

__commit 88ad465__
6 - Limitamos el consumo de cada Pod

Con kubernetes podemos establecer cuanta RAM y cuanta CPU va a tener disponible cada POD, de esta forma podemos controlar el uso y evitar que un error de código eleve el uso de CPU y Memoria y pueda hacer caer al Nodo completo, solo por poner un ejemplo.

```yaml
    apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
    name: servicio
    spec:
    # La mágia comienza acá
    replicas: 3

    template:
        metadata:
        labels:
            app: servicio
        spec:
    # y acá
        containers:
    # Puede ser una lista de contenedores en un POD
            - name: servicio
            image: "gcr.io/gdgscl/servicio:4"
            ports:
                - name: http
                containerPort: 8080
    # Veamos que Pod nos responde al Balancear - Ver server.js              
            env:
                - name: MY_NODE_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: spec.nodeName

                    
                - name: MY_POD_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: metadata.name

    #Podemos limitar los recursos que utiliza cada Pod

            resources:
                limits:
                cpu: 0.2
                memory: "100Mi"
```
Ya a esta altura deberias saber como aplicarlo pero te dejo el comando por si acaso.

```sh
    kubectl apply -f deployment.yaml
```

7 - Este commit se perdio en el limbo XD

__commit 486b6c7__
8 - Una mirada final de lo que se puede hacer

Lo último que veremos en este ejemplo son readinessProbe y livenessProbe.

__readinessProbe__ este mecanismo permite establecer cuando nuestro servicio esta listo para recibir trafico, y evitar que el balanceador le envie peticiones antes de que este todo listo a nivel de servicio.

__livenessProbe__ este mecanismo permite establecer un perior de tiempo y un endpoint de nuerstro servicio que sirva para preguntar si sigue con vida, de lo contrario Kubernetes va a matar al POD y crear uno nuevo, por que este no esta dando señales de vida.


```yaml
    apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
    name: servicio
    spec:
    # La mágia comienza acá
    replicas: 3

    template:
        metadata:
        labels:
            app: servicio
        spec:
    # y acá
        containers:
    # Puede ser una lista de contenedores en un POD
            - name: servicio
            image: "gcr.io/gdgscl/servicio:4"
            ports:
                - name: http
                containerPort: 8080
    # Veamos que Pod nos responde al Balancear - Ver server.js              
            env:
                - name: MY_NODE_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: spec.nodeName

                    
                - name: MY_POD_NAME
                valueFrom:
                    fieldRef:
                    fieldPath: metadata.name

    #Podemos limitar los recursos que utiliza cada Pod

            resources:
                limits:
                cpu: 0.2
                memory: "100Mi"

                
    # Validamos que nuesto pod esta vivo

            livenessProbe:
                httpGet:
                path: /health
                port: 8080
                scheme: HTTP
                initialDelaySeconds: 5
                periodSeconds: 15
                timeoutSeconds: 5

    # Esperamos a que este listo para mandarle carga 

            readinessProbe:
                httpGet:
                path: /ready
                port: 8080
                scheme: HTTP
                initialDelaySeconds: 5
                timeoutSeconds: 5
```
Si a esta altura no sabes como aplicar esta configuracion estamos mal, pero te la dejo igual XD.

```sh
    kubectl apply -f deployment.yaml
```

Espero que esto te sirva para entender como funciona básicamente Kubernetes y como llevar tu servicio a la Nube muy facilmente.

Un abrazo.










