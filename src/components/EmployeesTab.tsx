'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Mail,
  Phone,
  Building,
  DollarSign,
  Trash2,
  Power,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Calendar,
} from 'lucide-react';
import { Employee } from '@/lib/types';

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [message, setMessage] = useState('');

  // 13-Field Form State Matching User Screenshot 1:1
  const [employeeId, setEmployeeId] = useState('123456');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dept, setDept] = useState('IT');
  const [designation, setDesignation] = useState('Manager');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
  const [dateOfJoining, setDateOfJoining] = useState('2024-01-15');
  const [primaryManager, setPrimaryManager] = useState('-- None --');
  const [secondaryManager, setSecondaryManager] = useState('-- None --');
  const [employmentStatus, setEmploymentStatus] = useState('Active');
  const [employeeType, setEmployeeType] = useState('Full Time');
  const [salary, setSalary] = useState(75000);
  const [weeklyOff, setWeeklyOff] = useState('Sunday');

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedEmp(null);
    setEmployeeId(`EMP${Math.floor(100000 + Math.random() * 900000)}`);
    setName('');
    setEmail('');
    setPhone('');
    setDept('IT');
    setDesignation('Software Engineer');
    setRole('EMPLOYEE');
    setDateOfJoining(new Date().toISOString().split('T')[0]);
    setPrimaryManager('-- None --');
    setSecondaryManager('-- None --');
    setEmploymentStatus('Active');
    setEmployeeType('Full Time');
    setSalary(75000);
    setWeeklyOff('Sunday');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmployeeId(emp.employeeId || '123456');
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setDept(emp.department || 'IT');
    setDesignation(emp.designation || 'Manager');
    setRole((emp.role as any) || 'EMPLOYEE');
    setDateOfJoining(emp.dateOfJoining || '2024-01-15');
    setPrimaryManager(emp.primaryManager || '-- None --');
    setSecondaryManager(emp.secondaryManager || '-- None --');
    setEmploymentStatus(emp.status === 'INACTIVE' ? 'Inactive' : 'Active');
    setEmployeeType(emp.employeeType || 'Full Time');
    setSalary(emp.monthlySalary || 75000);
    setWeeklyOff(emp.weeklyOff || 'Sunday');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (emp: Employee) => {
    try {
      const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: emp.id,
          action: 'TOGGLE_STATUS',
          status: newStatus,
        }),
      });
      setMessage(`Employee ${emp.name} is now ${newStatus}!`);
      setTimeout(() => setMessage(''), 4000);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!empToDelete) return;
    try {
      await fetch(`/api/employees?id=${empToDelete.id}`, {
        method: 'DELETE',
      });
      setMessage(`Employee ${empToDelete.name} permanently deleted.`);
      setTimeout(() => setMessage(''), 4000);
      setIsDeleteModalOpen(false);
      setEmpToDelete(null);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmp ? selectedEmp.id : undefined,
          employeeId,
          name,
          email,
          phone,
          department: dept,
          designation,
          role: role || 'EMPLOYEE',
          dateOfJoining,
          primaryManager: primaryManager === '-- None --' ? '' : primaryManager,
          secondaryManager: secondaryManager === '-- None --' ? '' : secondaryManager,
          status: employmentStatus.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          employeeType,
          monthlySalary: salary,
          weeklyOff,
        }),
      });

      setMessage(selectedEmp ? `Profile updated for ${name}! Managers tab updated.` : `Created new employee profile for ${name}! Managers tab updated.`);
      setTimeout(() => setMessage(''), 4000);
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = employees.filter(
    e =>
      (e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || (e.employeeId && e.employeeId.toLowerCase().includes(search.toLowerCase()))) &&
      (department === 'ALL' || e.department === department) &&
      (statusFilter === 'ALL' || e.status === statusFilter)
  );

  // Dynamic Manager List for Primary & Secondary Manager dropdowns
  const managerList = employees.filter(e => e.role === 'MANAGER' || e.role === 'ADMIN' || e.designation?.toLowerCase().includes('manager'));

  return (
    <div className="space-y-6 text-slate-100 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2 font-heading">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Employee Directory & Profiles</span>
          </h2>
          <p className="text-xs text-slate-400">Manage employee accounts, reporting managers, designations, and weekly off policies.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, email, or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full"
            />
          </div>

          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Departments</option>
            <option value="Development">Development</option>
            <option value="Human Resources">Human Resources</option>
            <option value="SEO">SEO</option>
            <option value="Founders Office">Founders Office</option>
            <option value="General">General</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Deactivated Only</option>
          </select>
        </div>

        <p className="text-xs text-slate-400">Total Roster Members: <span className="text-white font-bold">{employees.length}</span></p>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filtered.map(emp => {
          const initials = emp.name.split(' ').map(n => n[0]).join('').toUpperCase();
          const isActive = emp.status === 'ACTIVE';

          return (
            <div
              key={emp.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition ${
                isActive ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/40 bg-slate-900/60 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow ${
                    isActive
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-500'
                      : 'bg-gradient-to-tr from-slate-700 to-slate-600'
                  }`}>
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm font-heading">{emp.name}</h4>
                    <span className="text-[10px] text-slate-400">{emp.designation || emp.role}</span>
                  </div>
                </div>

                {/* Edit & Actions */}
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenEditModal(emp)}
                    title="Edit Employee Details"
                    className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition flex items-center space-x-1 px-2 text-[11px] font-semibold"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(emp)}
                    title={isActive ? 'Deactivate Employee' : 'Activate Employee'}
                    className={`p-1.5 rounded-lg transition ${
                      isActive
                        ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-400'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setEmpToDelete(emp);
                      setIsDeleteModalOpen(true);
                    }}
                    title="Delete Employee"
                    className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-400" />
                    <span>Department</span>
                  </span>
                  <span className="text-slate-200 font-semibold">{emp.department || 'IT'}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>Email</span>
                  </span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[140px]">{emp.email}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Manager 1</span>
                  </span>
                  <span className="text-slate-200 font-semibold text-[11px] truncate max-w-[130px]">
                    {emp.primaryManager || '-- None --'}
                  </span>
                </div>

                {emp.secondaryManager && emp.secondaryManager !== '-- None --' && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      <span>Manager 2</span>
                    </span>
                    <span className="text-slate-200 font-semibold text-[11px] truncate max-w-[130px]">
                      {emp.secondaryManager}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px]">
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {emp.status}
                </span>
                <span className="text-slate-500 font-mono font-bold">ID: {emp.employeeId || '123456'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1:1 Edit Employee Profile Modal Matching User Screenshot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 max-w-4xl w-full space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-xl font-extrabold text-white font-heading">
                {selectedEmp ? 'Edit Employee Profile' : 'Add New Employee Profile'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              {/* 2-Column Grid Layout matching User Screenshot 1:1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {/* LEFT COLUMN */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">
                      Employee ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={employeeId}
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-300 font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Harshit Bhootra"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="info@harshitbhootra.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Department</label>
                    <input
                      type="text"
                      value={dept}
                      onChange={e => setDept(e.target.value)}
                      placeholder="e.g. IT"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Designation</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      placeholder="e.g. Manager"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">
                      Date of Joining <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dateOfJoining}
                      onChange={e => setDateOfJoining(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Primary Reporting Manager (Manager 1)</label>
                    <select
                      value={primaryManager}
                      onChange={e => setPrimaryManager(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="-- None --">-- None --</option>
                      {managerList.map(mgr => (
                        <option key={mgr.id} value={mgr.name}>
                          {mgr.name} ({mgr.department} • {mgr.designation || mgr.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Secondary Reporting Manager (Manager 2)</label>
                    <select
                      value={secondaryManager}
                      onChange={e => setSecondaryManager(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="-- None --">-- None --</option>
                      {managerList.map(mgr => (
                        <option key={mgr.id} value={mgr.name}>
                          {mgr.name} ({mgr.department} • {mgr.designation || mgr.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Employment Status</label>
                    <select
                      value={employmentStatus}
                      onChange={e => setEmploymentStatus(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Employee Type</label>
                    <select
                      value={employeeType}
                      onChange={e => setEmployeeType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Full Time">Full Time</option>
                      <option value="Part Time">Part Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Intern">Intern</option>
                    </select>
                  </div>



                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Weekly Off Day</label>
                    <select
                      value={weeklyOff}
                      onChange={e => setWeeklyOff(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Sunday">Sunday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Friday">Friday</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Form Buttons at bottom left */}
              <div className="flex items-center space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && empToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-white font-heading">Permanently Delete Employee</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{empToDelete.name}</strong> ({empToDelete.email})?
              <br /><br />
              <span className="text-red-400 font-semibold">Warning:</span> Once deleted, this employee will no longer be able to log into the portal.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setEmpToDelete(null);
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/30"
              >
                Permanently Delete Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
