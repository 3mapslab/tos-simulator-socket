const uuidV4 = require('uuid/v4');
const fs = require('fs'),
    path = require('path'),
    cellsFilepath = path.join(__dirname, '../config/cells.geojson');
const CARGO_TYPES = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/cargo_types.json')));
const CONTAINER_HEIGHT = 2.40;
const CONTAINER_ROTATION = 37.24;
const MAX_CONTAINERS_PER_LEVEL = 5;
const OPERATORS = [
    "maersk",
    "EVERGREEN",
    "Hamburg Sud",
    "uniglory",
    "hanjin",
    "hapag",
    "msc",
    "apl",
    "one",
    "ttc"
];

class DispatcherEvent {
    constructor(eventName) {
        this.eventName = eventName;
        this.callbacks = [];
    }

    registerCallback(callback) {
        this.callbacks.push(callback);
    }

    unregisterCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }

    fire(data) {
        const callbacks = this.callbacks.slice(0);
        callbacks.forEach((callback) => {
            callback(data);
        });
    }
}

class Container {

    constructor() {
        this.makeUpContainerInfo();
    }

    /**
     * ISO 6346 compliant container number composed by 4 Letters + 7 numbers: 
     * 
     *  Serial Number
     *    \      /
     * CSQU3044383
     * \ /        \
     * Owner       Check digit
     * code
     * 
     */
    getGeneratedCargoCode() {
        var numberFormatter = function (number, length) {
            var str = '' + number;
            while (str.length < length) {
                str = '0' + str;
            }
            return str;
        };
        var letterGenerator = function () {
            var alphabet = "abcdefghijklmnopqrstuvwxyz".toUpperCase();
            return alphabet.charAt(Math.random() * alphabet.length);
        }
        return letterGenerator() + letterGenerator() + letterGenerator() + letterGenerator() + numberFormatter(Math.floor(Math.random() * 999999), 7);

    }

    makeUpContainerInfo() {
        let cargoInfo = CARGO_TYPES[parseInt(Math.random() * CARGO_TYPES.length)];
        this.info = {};
        this.info.id = uuidV4();
        this.info.code = this.getGeneratedCargoCode();
        this.info.operator = OPERATORS[Math.floor(Math.random() * (OPERATORS.length))]; //one of the existing operators;
        this.info.type = {
            code: cargoInfo.type,
            description: cargoInfo.description,
        };
        this.info.dangerous = Math.random() >= 0.5;
    }
}

class ContainerSimulatorHelper {
    constructor() {
        console.log("Initializing ContainerSimulatorHelper...");
        this.events = {};
        this.cells = [];
        this.operations = [
            "ADD",
            "ADD",
            "ADD",
            "ADD",
            "ADD",
            "ADD",
            "ADD",
            "ADD",
            "REMOVE",
        ];
        fs.readFile(cellsFilepath, {
            encoding: 'utf-8'
        }, (err, data) => {
            if (!err) {
                this.cells = JSON.parse(data).features.map((v) => {
                    return {
                        code: v.properties["code"],
                        containers: [],
                        geometry: v.geometry,
                    };
                });
                this.startSimulation();
            } else {
                console.log(err);
            }
        });
    }

    static getInstance() {
        if (!ContainerSimulatorHelper._instance) {
            ContainerSimulatorHelper._instance = new ContainerSimulatorHelper();
        }
        return ContainerSimulatorHelper._instance;
    }

    dispatch(eventName, data) {
        const event = this.events[eventName];
        if (event) {
            event.fire(data);
        }
    }

    on(eventName, callback) {
        let event = this.events[eventName];
        if (!event) {
            event = new DispatcherEvent(eventName);
            this.events[eventName] = event;
        }
        event.registerCallback(callback);
    }

    off(eventName, callback) {
        const event = this.events[eventName];
        if (event && event.callbacks.indexOf(callback) > -1) {
            event.unregisterCallback(callback);
            if (event.callbacks.length === 0) {
                delete this.events[eventName];
            }
        }
    }

    // get occupied cells on start
    getOccupiedCells() {
        let occupiedCells = this.cells.filter((c) => {
            return c.containers.length > 0
        });
        let operation = "INITIAL_CELLS";
        let objectToSend = { operation, occupiedCells };
        return objectToSend;
    }

    startSimulation(options) {
        console.log("Cells are loaded up. Let's now start circulating containers...");
        let operationsToSchedule = Math.floor(Math.random() * (10 - 5) + 5); //1 to 10 operations simultaneously
        console.log("How many simultaneous operations: ", operationsToSchedule);
        for (let i = 0; i < operationsToSchedule; i++) {
            this.scheduleNewContainerOperation();
        }
    }

    scheduleNewContainerOperation() {
        setTimeout(() => {
            let operation = this.operations[Math.floor(Math.random() * (this.operations.length))]; //one of the existing operations
            let containerEvent = {
                operation
            };
            switch (operation) {
                case 'ADD':
                    //pick a cell to add
                    let cell = this.cells[Math.floor(Math.random() * (this.cells.length))]; //one of the existing cells
                    if (!cell.containers || cell.containers.length >= MAX_CONTAINERS_PER_LEVEL) {
                        break;
                    }
                    let container = new Container();
                    container.level = cell.containers.length;
                    container.height = (cell.containers.length) * CONTAINER_HEIGHT;
                    cell.containers.push(container);
                    containerEvent["code"] = container.info.code;
                    containerEvent["operator"] = container.info.operator;
                    containerEvent["type"] = container.info.type;
                    containerEvent["dangerous"] = container.info.dangerous;
                    containerEvent["cell"] = cell.code;
                    containerEvent["geometry"] = cell.geometry;
                    containerEvent["rotation"] = CONTAINER_ROTATION;
                    containerEvent["level"] = cell.containers.length;
                    containerEvent["height"] = (cell.containers.length - 1) * CONTAINER_HEIGHT;
                    this.dispatch('container_operation', containerEvent);
                    break;
                case 'REMOVE':
                    //pick a container to remove
                    let occupiedCells = this.cells.filter((c) => {
                        return c.containers.length > 0
                    });
                    if (occupiedCells.length > 0) {
                        let cell = occupiedCells[Math.floor(Math.random() * (occupiedCells.length))]; //one of the existing cells
                        let container = cell.containers.pop();
                        containerEvent["code"] = container.info.code;
                        containerEvent["operator"] = container.info.operator;
                        containerEvent["type"] = container.info.type;
                        containerEvent["dangerous"] = container.info.dangerous;
                        containerEvent["cell"] = cell.code;
                        containerEvent["geometry"] = cell.geometry;
                        containerEvent["rotation"] = CONTAINER_ROTATION;
                        containerEvent["level"] = cell.containers.length + 1;
                        containerEvent["height"] = (cell.containers.length) * CONTAINER_HEIGHT;
                        this.dispatch('container_operation', containerEvent);
                    }
                    break;
            }
            this.scheduleNewContainerOperation();
        },
            (Math.random() * (60 - 5) + 5) * 1000 //60 to 5 seconds of operation delay
        );
    }

    run() {
        this.isRunning = true;
    }
};

module.exports = ContainerSimulatorHelper;