let { botMessage, chatStatus } = require('../config/bot-message'),
    { CHATBOT_CONSOLE } = require('../config'),
    ChatStatusTable = require('../table/chat-status-table'),
    StagingConfessionTable = require('../table/staging-confession-cb'),
    { devLog } = require('../utility/utility'),
    { EventEmitter } = require('events')

class ConfessionBot extends EventEmitter {
    constructor() {
        super()
        this.consoleMode = CHATBOT_CONSOLE == 'true';
    }
    async init(userId) {
        this.userId = userId;
        this.language = 'vi';
        this.chatStatus = chatStatus['NEW'];
        this.confessionContent = ""
        this.insertedDate = new Date()
        this.updatedDate = this.insertedDate
        var data = await new Promise(function (resolve, reject) {
            ChatStatusTable.get(userId, function (data) {
                resolve(data)
            })
        })
        if (!data) {
            // create new chat status
            var chatStatusObj = {
                id: userId,
                language: this.language,
                status: this.chatStatus,
                confessionContent: this.confessionContent,
                insertedDate: this.insertedDate,
                updatedDate: this.updatedDate
            };
            await new Promise(function(resolve, reject){
                ChatStatusTable.insert(chatStatusObj, function (newObj) {
                    console.log(`--! Add user ${userId} to database: ${JSON.stringify(chatStatusObj)}`)
                    resolve(newObj)
                })
            }) 
        }
        else {
            this.language = data.language
            this.chatStatus = data.status
            this.confessionContent = data.confessionContent
            this.insertedDate = data.insertedDate
            this.updatedDate = data.updatedDate
        }
        this.getMessageData();
        this.emit('ready')
    }
    commitChanges() {
        this.updatedDate = new Date()
        ChatStatusTable.update({
            id: this.userId,
            language: this.language,
            status: this.chatStatus,
            confessionContent: this.confessionContent,
            updatedDate: this.updatedDate
        }, (function (data) {
            devLog(data)
        }));
    }

    insertConfession(content) {
        var obj = {
            content: Buffer.from(content).toString('base64'),
            status: StagingConfessionTable.STATUS.NEW,
            updatedDate: new Date(),
            insertedDate: new Date()
        }
        StagingConfessionTable.insert(obj, function(data) {
            console.log("New Staging confession object: " + data)
        })
    }
    /**
     * Set chat status
     */
    set(status) {
        this.chatStatus = chatStatus[status];
        return this;
    }
    /**
     * Check chat status
     */
    is(status) {
        return this.chatStatus == chatStatus[status];
    }
    /**
     * Set chat status then talk
     */
    talk(status, callback = function (status) { }) {
        if (status != undefined) {
            this.set(status);
            callback.bind(this)(status);
        }
        var msg = this.botMessage[this.chatStatus];
        this.responseMessage.push(msg);
        return this;
    }
    /**
     * Check commands
     */
    isCommand(message, commands, callback = function () { }) {
        for (var i = 0; i < commands.length; i++) {
            if (message == commands[i]) {
                callback.bind(this)();
                return true;
            }
        }
        return false;
    }
    processMessage(message) {
        this.responseMessage = [];
        if (this.is('NEW')) {
            this.talk().talk('COMMAND');
        }
        else if (this.is('PARDON')) {
            this.talk();
        }
        else if (this.is('ERROR')) {
            this.talk();
        }
        else if (this.is('COMMAND')) {
            this.isCommand(message, ['Chuyển ngôn ngữ', 'Change language'], function () {
                this.talk('CHANGE-LANGUAGE');
            });
            this.isCommand(message, ['Đăng confession', 'Post confession'], function () {
                this.talk('POST-CONFESSION');
            });
        }
        else if (this.is('CHANGE-LANGUAGE')) {
            this.isCommand(message, ['Tiếng Việt', 'Vietnamese'], function () {
                this.setLanguage('vi');
                this.responseMessage.push({ text: 'Đã chuyển sang Tiếng Việt.' });
            });
            this.isCommand(message, ['Tiếng Anh', 'English'], function () {
                this.setLanguage('en-us');
                this.responseMessage.push({ text: 'Switch to English.' });
            });
            this.talk('COMMAND');
        }
        else if (this.is('POST-CONFESSION')) {
            var isEnd = this.isCommand(message, ['End'], function () {
                this.talk('POST-CONFESSION-SUCESS');
            });
            if (isEnd) {
                this.insertConfession(this.confessionContent)
                this.confessionContent = ""    
                this.talk('COMMAND');
            } else {
                this.confessionContent += '\n' + message
            }
        }
        this.commitChanges();
        return this.responseMessage;
    }
    isLanguage(lang, callback = function () { }) {
        if (this.language == lang)
            callback.bind(this)();
        return this;
    }
    setLanguage(lang) {
        if (botMessage[lang] == undefined)
            throw `Language "${lang}" is not supported!`;
        this.language = lang;
        this.getMessageData();
        return this;
    }
    getMessageData() {
        this.botMessage = botMessage[this.language];
    }
}



module.exports = ConfessionBot;