// Curius API Client

pub mod model;
use reqwest::{Client, Response};
use serde::de::DeserializeOwned;
use serde_path_to_error;

/// Convenience function to parse JSON response with detailed path-to-error diagnostics
pub async fn parse_json_response<T: DeserializeOwned>(
    response: Response,
) -> Result<T, Box<dyn std::error::Error>> {
    if !response.status().is_success() {
        return Err(format!("HTTP request failed with status: {}", response.status()).into());
    }

    let response_text = response.text().await?;
    let jd = &mut serde_json::Deserializer::from_str(&response_text);
    let result: Result<T, _> = serde_path_to_error::deserialize(jd);

    match result {
        Ok(value) => Ok(value),
        Err(err) => {
            let path = err.path().to_string();
            Err(format!("JSON deserialization failed at path '{}': {}", path, err).into())
        }
    }
}

pub async fn get_content(user_id: i64) -> Result<model::LinkResponse, Box<dyn std::error::Error>> {
    let client = Client::new();
    let url = format!("https://curius.app/api/users/{}/links?page=0", user_id);

    let response = client.get(&url).send().await?;
    parse_json_response(response).await
}

pub async fn get_user_profile(
    user_handle: &str,
) -> Result<model::UserResponse, Box<dyn std::error::Error>> {
    let client = Client::new();
    let url = format!("https://curius.app/api/users/{}", user_handle);

    let response = client.get(&url).send().await?;
    parse_json_response(response).await
}
