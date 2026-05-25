// forgot-password
http://localhost:8080/api/auth/forgot-password
{
  "email": "sagar26io050@satiengg.in"
}


// Reset Password
http://localhost:8080/api/auth/reset-password/:token
{
  "password": "sagar123"
}


// checkin/checkout by tapping rfid
http://localhost:8080/api/checkin/tap
{
  "rfidCard": "RFID-STU-006"
}




# 📚 StudyAdda Library Management API

Base URL:

```
http://localhost:8080/api
```

---

# 🔐 AUTH

## Login

```
POST /auth/login
```

---

# 🪑 SEAT MANAGEMENT

## Get All Seats

```
GET /seat
```

---

## Get Seat Statistics

```
GET /seat/statistics
```

---

## Book Seat (Reserve / Occupy)

```
POST /seat/:seatId/book
```

### Body:

```json
{}
```

### Behavior:

* Not checked-in → Seat becomes **booked (20 min)**
* Already checked-in → Seat becomes **occupied**

---

## Release Seat (Manual)

```
POST /seat/:seatId/release
```

---

## Get My Current Booking

```
GET /seat/my-booking
```

---

## Get My Booking History

```
GET /seat/my-bookings
```

---

# 📡 RFID CHECK-IN / CHECKOUT (MAIN FLOW)

## Tap RFID (Auto CheckIn / CheckOut)

```
POST /checkin/tap
```

### Body:

```json
{
  "rfidCard": "RFID-STU-001"
}
```

### Behavior:

### 👉 First Tap:

* Student **checked-in**
* If seat is booked → becomes **occupied**

### 👉 Second Tap:

* Student **checked-out**
* Seat → becomes **available**

---

# 📊 CHECK-IN MANAGEMENT (ADMIN)

## Get All CheckIns

```
GET /checkin
```

---

## Get Student CheckIn History

```
GET /checkin/student/:studentId
```

---

## Manual CheckIn (Admin)

```
POST /checkin/checkin
```

### Body:

```json
{
  "rfidCard": "RFID-STU-001"
}
```

---

## Manual CheckOut (Admin)

```
POST /checkin/checkout/:checkInId
```

---

## CheckOut by RFID (Admin)

```
POST /checkin/checkout-rfid
```

### Body:

```json
{
  "rfidCard": "RFID-STU-001"
}
```

---

# ⚙️ SYSTEM LOGIC

## Seat Flow

```
available → booked → occupied → available
```

---

## Rules

* Seat reservation valid for **20 minutes**
* No check-in → auto release
* Check-in → seat becomes occupied
* Check-out → seat becomes available
* RFID tap handles both check-in and check-out

---

# ⚠️ NOTES

* Uses **session-based authentication (cookies)**
* No JWT required
* Always use **seatId (_id)**, not seatNumber
* Cookie must be included in every request

---
