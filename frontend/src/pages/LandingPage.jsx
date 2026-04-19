import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import { useEffect } from "react";

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  return (
    <div>
      <section className="hero">
        <h1>Discover Your Signature Scent</h1>
        <p>Explore our curated collection of premium perfumes and find the perfect fragrance for every occasion.</p>
        <a href="#products" className="hero-cta">Shop Now</a>
      </section>

      <section id="products" className="page-content">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Featured Products</h2>
        <div className="product-grid">
          <div className="product-card">
            <div className="product-image">🧴</div>
            <h3 className="product-name">Eau de Parfum</h3>
            <p className="product-price">$89.99</p>
            <button className="product-btn">Add to Cart</button>
          </div>
          <div className="product-card">
            <div className="product-image">💐</div>
            <h3 className="product-name">Floral Essence</h3>
            <p className="product-price">$75.99</p>
            <button className="product-btn">Add to Cart</button>
          </div>
          <div className="product-card">
            <div className="product-image">🌿</div>
            <h3 className="product-name">Herbal Mist</h3>
            <p className="product-price">$65.99</p>
            <button className="product-btn">Add to Cart</button>
          </div>
        </div>
      </section>
    </div>
  );
}
