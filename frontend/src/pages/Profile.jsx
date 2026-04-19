import { useAuth } from "../AuthProvider";

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="card">
      <h1 className="heading">Profile</h1>
      <div className="field">
        <label>Name</label>
        <input type="text" value={user.name} readOnly />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="text" value={user.email} readOnly />
      </div>
      <div className="field">
        <label>Role</label>
        <input type="text" value={user.role} readOnly />
      </div>
      <div className="field">
        <label>Status</label>
        <input type="text" value={user.status} readOnly />
      </div>
    </div>
  );
}
