class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // { duration: { $gte: '5' }, difficulty: 'easy' } ->($) this sign is what we get when we use filter method on code by mongoDb
    // { duration: { gte: '5' }, difficulty: 'easy' } ->so here in (gte) we dont get upper sign as it is just a console log of the query so if we just replace the above sign below we can impliment this(gte) greater then operatation in query
    //and other sign which we cant to replace->gte,gt,lte,lt

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    //let query = Tour.find(JSON.parse(queryStr));

    return this; // means returning entire object
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      //this -__v means this filed in data in mongoDb will not get selected and then showed on data when we call the api everything else will be called
      this.query = this.query.select('-__v');
    }

    return this;
  }
  pagination() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    //we have in url ->?page=2&limit=10, means , 1-10, page 1,11-20, page 2,21-30 page 3
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
