package com.myhaimi.sms;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmsApplication {

	static {
		Dotenv dotenv = Dotenv.configure()
				.directory("./") // Ensures it looks for the .env file in the root directory
				.ignoreIfMalformed()
				.ignoreIfMissing()
				.load();

		System.setProperty("GOOGLE_CLIENT_ID", dotenv.get("GOOGLE_CLIENT_ID", "id"));
		System.setProperty("GOOGLE_CLIENT_SECRET", dotenv.get("GOOGLE_CLIENT_SECRET", "secret"));
	}

	public static void main(String[] args) {
		SpringApplication.run(SmsApplication.class, args);
		System.out.println("Swagger UI: http://localhost:8080/swagger-ui/index.html");
	}

}
