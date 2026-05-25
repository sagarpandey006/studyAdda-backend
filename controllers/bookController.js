const Book = require('../models/book')
const mongoose = require("mongoose");
const { uploadToCloudinary } = require("../utils/cloudinary");

const getBook = async (req, res) => {
  const bookId = req.params.id;

  Book.findById(bookId, (err, book) => {
    if (err) {
      return res.status(400).json({ success: false, err });
    }

    return res.status(200).json({
      success: true,
      book
    });
  });
}

const getAllBooks = async (req, res) => {
  Book.aggregate([{
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    },
  },
  {
    $unwind: "$author"
  },
  {
    $lookup: {
      from: "genres",
      localField: "genreId",
      foreignField: "_id",
      as: "genre"
    },

  },
  {
    $unwind: "$genre"
  },]).exec((err, books) => {
    if (err) {
      return res.status(400).json({ success: false, err });
    }

    return res.status(200).json({
      success: true,
      booksList: books
    });
  });
}

const addBook = async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const newBook = {
      ...req.body,
      genreId: mongoose.Types.ObjectId(req.body.genreId),
      authorId: mongoose.Types.ObjectId(req.body.authorId),
      photoUrl: imageUrl,
    };

    const book = await Book.create(newBook);

    return res.status(200).json({
      success: true,
      newBook: book,
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, err });
  }
};

const updateBook = async (req, res) => {
  try {
    const bookId = req.params.id;
    let updatedData = { ...req.body };

    if (req.file) {
      const imageUrl = await uploadToCloudinary(req.file.buffer);
      updatedData.photoUrl = imageUrl;
    }

    const book = await Book.findByIdAndUpdate(bookId, updatedData, { new: true });

    return res.status(200).json({
      success: true,
      updatedBook: book,
    });

  } catch (err) {
    return res.status(500).json({ success: false, err });
  }
};

const deleteBook = async (req, res) => {
  const bookId = req.params.id

  Book.findByIdAndDelete(bookId, (err, book) => {
    if (err) {
      return res.status(400).json({ success: false, err });
    }

    return res.status(200).json({
      success: true,
      deletedBook: book
    });
  })
}

module.exports = {
  getBook,
  getAllBooks,
  addBook,
  updateBook,
  deleteBook
}
