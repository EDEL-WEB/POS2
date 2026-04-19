import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="card">
      <h1 className="heading">Page Not Found</h1>
      <p className="small">The page you are looking for does not exist.</p>
      <Link to="/" className="primary">
        Return Home
      </Link>
    </div>
  );
}
