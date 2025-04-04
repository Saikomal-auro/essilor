import React from "react";

function ProductTile({ product }) {
  return (
    <div className="border rounded-md p-4 shadow-md bg-white">
      <div className="flex items-center justify-between">
        {/* Product Image */}
        <img
          src={product["Image URL"]}
          alt={product["Product Name"]}
          className="w-32 h-32 object-cover rounded-md"
          loading="lazy"
        />

        {/* Product Details */}
        <div className="ml-4 flex-grow">
          <h3 className="font-semibold text-lg text-gray-900">{product["Product Name"]}</h3>
          <p className="text-sm text-gray-600">{product["Brand Name"]}</p>
          <p className="text-sm text-gray-500">Price: ₹{product["Price"]}</p>
          <p className="text-sm text-gray-500">Lens Color: {product["Lens Color"]}</p>
          <p className="text-sm text-gray-500">Frame Color: {product["Frame Colour"]}</p>
          <p className="text-sm text-gray-500">Discount: {product["Discount"]}</p>
        </div>
      </div>
    </div>
  );
}

export default ProductTile;
