exports.ConfigException = class {
    constructor(message) {
        this.message = message;
        this.name = 'ConfigException';
    }
};
