Rails.application.routes.draw do
  root to: "home#index"

  # a comment that must not be parsed
  get "/about", to: "pages#about"
  get "/contact", to: "pages#contact", as: :reach_us
  get "/posts/:id/preview", to: "posts#preview"

  resources :posts
  resources :categories
  resource :session

  namespace :admin do
    resources :users
  end
end
