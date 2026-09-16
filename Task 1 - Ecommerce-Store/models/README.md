# Models Directory

This directory will store your Mongoose data models and schemas.

### Planned Models for this E-Commerce Store:
- **`User.js`**: User schema containing `name`, `email`, `password` (hashed using `bcryptjs`), and `role` (`user` or `admin`).
- **`Product.js`**: Product schema containing `title`, `description`, `price`, `image`, `category`, and `stockCount`.
- **`Order.js`**: Order schema containing `userId`, `items`, `totalAmount`, `shippingAddress`, `status`, and timestamps.
