import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize DB if not exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

class Collection {
    constructor(name) {
        this.name = name;
    }

    _readDb() {
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading DB:', error);
            return {};
        }
    }

    _writeDb(data) {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error writing DB:', error);
        }
    }

    _getCollection() {
        const db = this._readDb();
        if (!db[this.name]) {
            db[this.name] = [];
            this._writeDb(db);
        }
        return db[this.name];
    }

    _saveCollection(collectionData) {
        const db = this._readDb();
        db[this.name] = collectionData;
        this._writeDb(db);
    }

    async find(query = {}) {
        const collection = this._getCollection();
        if (Object.keys(query).length === 0) return collection;

        return collection.filter(item => {
            for (let key in query) {
                // Handle simple equality
                if (item[key] != query[key]) return false;
            }
            return true;
        });
    }

    async findOne(query) {
        const collection = this._getCollection();
        return collection.find(item => {
            for (let key in query) {
                if (item[key] != query[key]) return false;
            }
            return true;
        }) || null;
    }

    async findById(id) {
        const collection = this._getCollection();
        return collection.find(item => item._id === id) || null;
    }

    async create(data) {
        const collection = this._getCollection();
        // Handle _id generation if not present
        if (!data._id) {
            data._id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        }

        collection.push(data);
        this._saveCollection(collection);
        return data;
    }

    async findByIdAndUpdate(id, update, options = {}) {
        const collection = this._getCollection();
        const index = collection.findIndex(item => item._id === id);

        if (index === -1) {
            if (options.upsert) {
                const newItem = { _id: id, ...update };
                collection.push(newItem);
                this._saveCollection(collection);
                return newItem;
            }
            return null;
        }

        const updatedItem = { ...collection[index], ...update };
        collection[index] = updatedItem;
        this._saveCollection(collection);
        return updatedItem;
    }

    async findOneAndUpdate(query, update, options = {}) {
        const collection = this._getCollection();
        const index = collection.findIndex(item => {
            for (let key in query) {
                if (item[key] != query[key]) return false;
            }
            return true;
        });

        if (index === -1) {
            if (options.upsert) {
                const newItem = { ...query, ...update };
                if (!newItem._id) newItem._id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                collection.push(newItem);
                this._saveCollection(collection);
                return newItem;
            }
            return null;
        }

        const updatedItem = { ...collection[index], ...update };
        collection[index] = updatedItem;
        this._saveCollection(collection);
        return updatedItem;
    }

    async findByIdAndDelete(id) {
        const collection = this._getCollection();
        const index = collection.findIndex(item => item._id === id);
        if (index === -1) return null;

        const deletedItem = collection[index];
        collection.splice(index, 1);
        this._saveCollection(collection);
        return deletedItem;
    }

    async deleteOne(query) {
        const collection = this._getCollection();
        const index = collection.findIndex(item => {
            for (let key in query) {
                if (item[key] != query[key]) return false;
            }
            return true;
        });
        if (index === -1) return null;

        const deletedItem = collection[index];
        collection.splice(index, 1);
        this._saveCollection(collection);
        return deletedItem;
    }

    async deleteMany(query) {
        let collection = this._getCollection();
        const initialLength = collection.length;

        if (Object.keys(query).length === 0) {
            // Delete all
            this._saveCollection([]);
            return { deletedCount: initialLength };
        }

        const newCollection = collection.filter(item => {
            for (let key in query) {
                if (item[key] == query[key]) return false; // Remove if matches
            }
            return true; // Keep if doesn't match
        });

        this._saveCollection(newCollection);
        return { deletedCount: initialLength - newCollection.length };
    }

    async countDocuments(query = {}) {
        const docs = await this.find(query);
        return docs.length;
    }
}

export default (name) => new Collection(name);
