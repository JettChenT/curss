use crate::curius::model::Content;
use eyre::Result;
use reqwest::Url;
use rss::{Guid, Item, ItemBuilder};

fn get_source_domain(link: &str) -> Result<String> {
    let url = Url::parse(link)?;
    Ok(url.host_str().unwrap().to_string())
}

impl Content {
    pub fn to_rss_item(self) -> Result<Item> {
        let item = ItemBuilder::default()
            .guid(Guid {
                value: format!("curius-{}", self.id),
                permalink: false,
            })
            .title(self.title.clone())
            .description(self.get_description())
            .link(self.link.clone())
            .pub_date(self.created_date.clone())
            .author(get_source_domain(&self.link).unwrap_or_else(|_x| self.link.clone()))
            .build();
        Ok(item)
    }

    fn get_saved_by_string(&self) -> Option<String> {
        self.saved_by.as_ref().map(|saved_by| {
            saved_by
                .iter()
                .map(|follow| {
                    format!(
                        "<a href=\"https://curius.app/{}\">{} {}</a>",
                        follow.following_user.user_link,
                        follow.following_user.first_name,
                        follow.following_user.last_name
                    )
                })
                .collect::<Vec<String>>()
                .join(", ")
        })
    }

    fn get_description(&self) -> String {
        let mut description = String::new();
        if let Some(saved_by) = self.get_saved_by_string() {
            description.push_str(&format!("<p>Saved by: {} </p>", saved_by));
        }
        if let Some(snippet) = &self.snippet {
            description.push_str(&format!("<p>{}</p>", snippet));
        }
        description
    }
}
