# SMS - School Management System

A full-stack school management application built with Spring Boot backend and React frontend.

## Prerequisites

Before running the application, ensure you have the following installed:

- **Java 21** or higher
- **Node.js 18+** and npm
- **MySQL 8.0+** (running on port 3307)
- **Gradle** (included with gradlew)

## Installation

### 1. Clone and Setup

```bash
# Navigate to the project directory
cd /Users/shivamjaiswal/Desktop/sms
```

### 2. Set Environment Variables (Optional)

Create a `.env` file or set environment variables for OAuth and security settings:

```bash
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret
export SMS_GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:5173/oauth/google
export JWT_SECRET=your-secret-key-min-32-chars
export SMS_PLATFORM_OWNER_EMAIL_DOMAINS=myhaimi.com
```

## Running the Application

### Option 1: Run Frontend and Backend Separately (Recommended for Development)

#### Terminal 1 - Start Backend (Spring Boot)

```bash
cd /Users/shivamjaiswal/Desktop/sms
./gradlew bootRun
```

The backend will start on **http://localhost:8080**

#### Terminal 2 - Start Frontend (React + Vite)

```bash
cd /Users/shivamjaiswal/Desktop/sms/frontend
npm install  # First time only
npm run dev
```

The frontend will start on **http://localhost:5173**

### Option 2: Run with Docker Compose

```bash
# Using the development compose file
docker-compose -f docker/docker-compose.yml up

# Or using the SaaS compose file
docker-compose -f docker/docker-compose.saas.yml up
```

## Accessing the Application

Once both services are running:

1. **Frontend**: Open your browser and navigate to [http://localhost:5173](http://localhost:5173)
2. **Backend API**: [http://localhost:8080](http://localhost:8080)
3. **API Documentation (Swagger)**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
4. **Health Check**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)

## Default Credentials

The application comes with pre-configured demo data:

### Superadmin Account
- **Username**: `superadmin`
- **Email**: `superadmin@myhaimi.com`
- **Password**: `abc`

### Demo School
- **Password**: `demo123`
- **School Name**: Greenwood International (auto-created on first run)

## Database Configuration

The application uses MySQL with Flyway migrations:

- **Host**: localhost
- **Port**: 3307
- **Database**: newdb
- **Username**: root
- **Password**: root

**Note**: Database is automatically created and migrations are applied on first run.

## Project Structure

```
sms/
├── src/
│   ├── main/java/           # Spring Boot backend
│   └── resources/
│       └── db/migration/    # Database migrations (Flyway)
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── docker/                   # Docker compose files
├── docs/                     # Documentation
├── build.gradle             # Backend build configuration
└── README.md
```

## Key Features

- **Backend**: Spring Boot 3.4.3 with Spring Security, JWT, OAuth2
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query
- **Database**: MySQL with automated migrations (Flyway)
- **API Documentation**: Swagger/OpenAPI
- **Authentication**: JWT tokens with OAuth2 support (Google)
- **Demo Data**: Greenwood International school with classes, students, and marks

## Troubleshooting

### Backend won't start
- Ensure MySQL is running on port 3307
- Check that Java 21+ is installed: `java -version`
- Clear build cache: `./gradlew clean`

### Frontend won't start
- Clear node_modules: `rm -rf node_modules && npm install`
- Ensure port 5173 is not in use: `lsof -i :5173`

### Database connection issues
- Verify MySQL is running: `mysql -h localhost -P 3307 -u root -p`
- Check application.properties database configuration
- Ensure database `newdb` exists or will be auto-created

### CORS issues
- Update `SMS_CORS_ALLOWED_ORIGINS` in application.properties
- Default allows: localhost:5173-5176

## Development

### Building for Production

#### Backend
```bash
./gradlew build
```

#### Frontend
```bash
cd frontend
npm run build
```

### Running Tests

#### Backend
```bash
./gradlew test
```

#### Frontend
```bash
cd frontend
npm run test  # If test script is available
```

## Additional Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Features and Roles](docs/FEATURES_AND_ROLES.md)
- [SaaS Architecture](docs/SAAS_ARCHITECTURE.md)

## Support

For issues and questions, please check:
- Application logs in the terminal
- Browser console for frontend errors (F12)
- Spring Boot actuator endpoints for health diagnostics

