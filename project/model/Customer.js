class Customer {
  constructor({ id, name, address = null } = {}) {
    this.id = id || null;
    this.name = name || "Unknown";
    this.address = address;
  }
}

module.exports = Customer;
